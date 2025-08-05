import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import express from "express";
import { Ticket } from "../../models/Ticket";
import ticketsRouter from "../tickets";

const app = express();
app.use(express.json());
app.use("/api/tickets", ticketsRouter);

describe("Tickets API", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db.collection("tickets").deleteMany({});
  });

  describe("GET /", () => {
    beforeEach(async () => {
      const tickets = [
        {
          ticketId: 12345,
          title: "Critical Bug Fix",
          description: "Fix critical security issue",
          status: "new",
          type: "defect",
          priority: "high",
          component: "core",
          createdAt: new Date("2023-01-01"),
        },
        {
          ticketId: 12346,
          title: "Feature Enhancement",
          description: "Add new feature to admin panel",
          status: "assigned",
          type: "enhancement",
          priority: "normal",
          component: "admin",
          createdAt: new Date("2023-01-02"),
        },
        {
          ticketId: 12347,
          title: "Documentation Update",
          description: "Update API documentation",
          status: "closed",
          type: "task",
          priority: "low",
          component: "docs",
          createdAt: new Date("2023-01-03"),
        },
      ];

      await Ticket.insertMany(tickets);
    });

    it("should return all tickets", async () => {
      const response = await request(app).get("/api/tickets/");

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(3);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(50);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(2);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
    });

    it("should support filtering by status", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ status: "new" });

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].status).toBe("new");
    });

    it("should support filtering by type", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ type: "enhancement" });

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].type).toBe("enhancement");
    });

    it("should support filtering by priority", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ priority: "high" });

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].priority).toBe("high");
    });

    it("should support filtering by component", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ component: "core" });

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].component).toBe("core");
    });

    it("should support text search", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ search: "critical bug" });

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].title).toContain("Critical Bug");
    });

    it("should support sorting by ticketId", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ sortBy: "ticketId", sortOrder: "desc" });

      expect(response.status).toBe(200);
      expect(response.body.tickets[0].ticketId).toBe(12347);
      expect(response.body.tickets[1].ticketId).toBe(12346);
      expect(response.body.tickets[2].ticketId).toBe(12345);
    });

    it("should support sorting by createdAt", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ sortBy: "createdAt", sortOrder: "asc" });

      expect(response.status).toBe(200);
      expect(new Date(response.body.tickets[0].createdAt)).toEqual(
        new Date("2023-01-01")
      );
    });

    it("should handle invalid sortBy parameter", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ sortBy: "invalidField" });

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(3);
    });

    it("should handle invalid sortOrder parameter", async () => {
      const response = await request(app)
        .get("/api/tickets/")
        .query({ sortOrder: "invalid" });

      expect(response.status).toBe(200);
      expect(response.body.tickets).toHaveLength(3);
    });
  });

  describe("GET /:ticketId", () => {
    beforeEach(async () => {
      const ticket = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        description: "Test description",
        status: "new",
        type: "enhancement",
        priority: "normal",
        component: "test",
        comments: [
          {
            id: 1,
            author: "testuser",
            content: "Test comment",
            timestamp: new Date(),
          },
        ],
      });

      await ticket.save();
    });

    it("should return a specific ticket", async () => {
      const response = await request(app).get("/api/tickets/12345");

      expect(response.status).toBe(200);
      expect(response.body.ticketId).toBe(12345);
      expect(response.body.title).toBe("Test Ticket");
      expect(response.body.comments).toHaveLength(1);
    });

    it("should return 404 for non-existent ticket", async () => {
      const response = await request(app).get("/api/tickets/99999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Ticket not found");
    });

    it("should handle invalid ticket ID format", async () => {
      const response = await request(app).get("/api/tickets/invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid ticket ID");
    });
  });

  describe("POST /save", () => {
    it("should save a new ticket", async () => {
      const ticketData = {
        ticketId: 12345,
        title: "New Test Ticket",
        description: "New test description",
        status: "new",
        type: "enhancement",
        priority: "normal",
        component: "test",
      };

      const response = await request(app)
        .post("/api/tickets/save")
        .send(ticketData);

      expect(response.status).toBe(201);
      expect(response.body.ticketId).toBe(12345);
      expect(response.body.title).toBe("New Test Ticket");

      // Verify ticket was saved to database
      const savedTicket = await Ticket.findOne({ ticketId: 12345 });
      expect(savedTicket).toBeDefined();
      expect(savedTicket?.title).toBe("New Test Ticket");
    });

    it("should update existing ticket", async () => {
      // Create initial ticket
      const initialTicket = new Ticket({
        ticketId: 12345,
        title: "Original Title",
        description: "Original description",
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      await initialTicket.save();

      // Update ticket
      const updateData = {
        ticketId: 12345,
        title: "Updated Title",
        description: "Updated description",
        status: "assigned",
        type: "defect",
        priority: "high",
      };

      const response = await request(app)
        .post("/api/tickets/save")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe("Updated Title");
      expect(response.body.status).toBe("assigned");

      // Verify ticket was updated in database
      const updatedTicket = await Ticket.findOne({ ticketId: 12345 });
      expect(updatedTicket?.title).toBe("Updated Title");
      expect(updatedTicket?.status).toBe("assigned");
    });

    it("should validate required fields", async () => {
      const invalidTicketData = {
        title: "Test Ticket",
        // Missing ticketId, status, type, priority
      };

      const response = await request(app)
        .post("/api/tickets/save")
        .send(invalidTicketData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("should handle invalid enum values", async () => {
      const invalidTicketData = {
        ticketId: 12345,
        title: "Test Ticket",
        status: "invalid-status",
        type: "enhancement",
        priority: "normal",
      };

      const response = await request(app)
        .post("/api/tickets/save")
        .send(invalidTicketData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /scrape/:ticketId", () => {
    it("should return 404 for non-existent ticket", async () => {
      const response = await request(app).get("/api/tickets/scrape/99999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Ticket not found");
    });

    it("should handle invalid ticket ID format", async () => {
      const response = await request(app).get("/api/tickets/scrape/invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid ticket ID");
    });

    // Note: Testing actual scraping would require mocking external HTTP requests
    // This is typically done with tools like nock or jest-mock-fetch
  });

  describe("Error Handling", () => {
    it("should handle database connection errors", async () => {
      // Temporarily disconnect from database
      await mongoose.disconnect();

      const response = await request(app).get("/api/tickets/");

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();

      // Reconnect for cleanup
      await mongoose.connect(mongoServer.getUri());
    });

    it("should handle malformed JSON in POST requests", async () => {
      const response = await request(app)
        .post("/api/tickets/save")
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});
