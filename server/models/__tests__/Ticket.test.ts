import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Ticket, ITicket } from "../Ticket";

describe("Ticket Model", () => {
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

  describe("Schema Validation", () => {
    it("should create a valid ticket", async () => {
      const validTicket = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        description: "This is a test ticket",
        status: "new",
        type: "enhancement",
        priority: "normal",
        component: "test-component",
        reporter: "testuser",
        owner: "testowner",
        cc: ["user1", "user2"],
        keywords: ["test", "bug"],
        milestone: "6.0",
        version: "6.0",
        resolution: "fixed",
        createdAt: new Date(),
        updatedAt: new Date(),
        comments: [
          {
            id: 1,
            author: "testuser",
            content: "Test comment",
            timestamp: new Date(),
          },
        ],
      });

      const savedTicket = await validTicket.save();
      expect(savedTicket.ticketId).toBe(12345);
      expect(savedTicket.title).toBe("Test Ticket");
      expect(savedTicket.status).toBe("new");
      expect(savedTicket.type).toBe("enhancement");
      expect(savedTicket.priority).toBe("normal");
    });

    it("should require ticketId", async () => {
      const ticketWithoutId = new Ticket({
        title: "Test Ticket",
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      await expect(ticketWithoutId.save()).rejects.toThrow();
    });

    it("should require title", async () => {
      const ticketWithoutTitle = new Ticket({
        ticketId: 12345,
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      await expect(ticketWithoutTitle.save()).rejects.toThrow();
    });

    it("should validate status enum values", async () => {
      const ticketWithInvalidStatus = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "invalid-status",
        type: "enhancement",
        priority: "normal",
      });

      await expect(ticketWithInvalidStatus.save()).rejects.toThrow();
    });

    it("should validate type enum values", async () => {
      const ticketWithInvalidType = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "new",
        type: "invalid-type",
        priority: "normal",
      });

      await expect(ticketWithInvalidType.save()).rejects.toThrow();
    });

    it("should validate priority enum values", async () => {
      const ticketWithInvalidPriority = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "new",
        type: "enhancement",
        priority: "invalid-priority",
      });

      await expect(ticketWithInvalidPriority.save()).rejects.toThrow();
    });

    it("should enforce unique ticketId", async () => {
      const ticket1 = new Ticket({
        ticketId: 12345,
        title: "Test Ticket 1",
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      const ticket2 = new Ticket({
        ticketId: 12345,
        title: "Test Ticket 2",
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      await ticket1.save();
      await expect(ticket2.save()).rejects.toThrow();
    });
  });

  describe("Text Indexing", () => {
    it("should support text search on title and description", async () => {
      const ticket1 = new Ticket({
        ticketId: 12345,
        title: "WordPress Core Bug Fix",
        description: "Fix critical bug in WordPress core functionality",
        status: "new",
        type: "defect",
        priority: "high",
      });

      const ticket2 = new Ticket({
        ticketId: 12346,
        title: "Plugin Enhancement",
        description: "Add new feature to plugin system",
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      await ticket1.save();
      await ticket2.save();

      const searchResults = await Ticket.find({
        $text: { $search: "WordPress core bug" },
      });

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].ticketId).toBe(12345);
    });
  });

  describe("Comment Management", () => {
    it("should handle comments correctly", async () => {
      const ticket = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "new",
        type: "enhancement",
        priority: "normal",
        comments: [
          {
            id: 1,
            author: "user1",
            content: "First comment",
            timestamp: new Date("2023-01-01"),
          },
          {
            id: 2,
            author: "user2",
            content: "Second comment",
            timestamp: new Date("2023-01-02"),
          },
        ],
      });

      const savedTicket = await ticket.save();
      expect(savedTicket.comments).toHaveLength(2);
      expect(savedTicket.comments[0].author).toBe("user1");
      expect(savedTicket.comments[1].author).toBe("user2");
    });

    it("should handle empty comments array", async () => {
      const ticket = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "new",
        type: "enhancement",
        priority: "normal",
        comments: [],
      });

      const savedTicket = await ticket.save();
      expect(savedTicket.comments).toHaveLength(0);
    });
  });

  describe("Timestamps", () => {
    it("should automatically set createdAt and updatedAt", async () => {
      const ticket = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      const savedTicket = await ticket.save();
      expect(savedTicket.createdAt).toBeDefined();
      expect(savedTicket.updatedAt).toBeDefined();
    });

    it("should update updatedAt on save", async () => {
      const ticket = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      const savedTicket = await ticket.save();
      const originalUpdatedAt = savedTicket.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      savedTicket.title = "Updated Title";
      const updatedTicket = await savedTicket.save();

      expect(updatedTicket.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe("Optional Fields", () => {
    it("should handle optional fields correctly", async () => {
      const ticket = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "new",
        type: "enhancement",
        priority: "normal",
        // Optional fields
        component: "test-component",
        reporter: "testuser",
        owner: "testowner",
        cc: ["user1", "user2"],
        keywords: ["test", "bug"],
        milestone: "6.0",
        version: "6.0",
        resolution: "fixed",
      });

      const savedTicket = await ticket.save();
      expect(savedTicket.component).toBe("test-component");
      expect(savedTicket.reporter).toBe("testuser");
      expect(savedTicket.owner).toBe("testowner");
      expect(savedTicket.cc).toEqual(["user1", "user2"]);
      expect(savedTicket.keywords).toEqual(["test", "bug"]);
      expect(savedTicket.milestone).toBe("6.0");
      expect(savedTicket.version).toBe("6.0");
      expect(savedTicket.resolution).toBe("fixed");
    });

    it("should save ticket without optional fields", async () => {
      const ticket = new Ticket({
        ticketId: 12345,
        title: "Test Ticket",
        status: "new",
        type: "enhancement",
        priority: "normal",
      });

      const savedTicket = await ticket.save();
      expect(savedTicket.ticketId).toBe(12345);
      expect(savedTicket.title).toBe("Test Ticket");
      expect(savedTicket.component).toBeUndefined();
      expect(savedTicket.reporter).toBeUndefined();
    });
  });

  describe("Query Methods", () => {
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
        },
        {
          ticketId: 12346,
          title: "Feature Enhancement",
          description: "Add new feature to admin panel",
          status: "assigned",
          type: "enhancement",
          priority: "normal",
          component: "admin",
        },
        {
          ticketId: 12347,
          title: "Documentation Update",
          description: "Update API documentation",
          status: "closed",
          type: "task",
          priority: "low",
          component: "docs",
        },
      ];

      await Ticket.insertMany(tickets);
    });

    it("should find tickets by status", async () => {
      const newTickets = await Ticket.find({ status: "new" });
      expect(newTickets).toHaveLength(1);
      expect(newTickets[0].ticketId).toBe(12345);
    });

    it("should find tickets by type", async () => {
      const enhancementTickets = await Ticket.find({ type: "enhancement" });
      expect(enhancementTickets).toHaveLength(1);
      expect(enhancementTickets[0].ticketId).toBe(12346);
    });

    it("should find tickets by priority", async () => {
      const highPriorityTickets = await Ticket.find({ priority: "high" });
      expect(highPriorityTickets).toHaveLength(1);
      expect(highPriorityTickets[0].ticketId).toBe(12345);
    });

    it("should find tickets by component", async () => {
      const coreTickets = await Ticket.find({ component: "core" });
      expect(coreTickets).toHaveLength(1);
      expect(coreTickets[0].ticketId).toBe(12345);
    });

    it("should find tickets by multiple criteria", async () => {
      const tickets = await Ticket.find({
        status: "new",
        priority: "high",
      });
      expect(tickets).toHaveLength(1);
      expect(tickets[0].ticketId).toBe(12345);
    });

    it("should sort tickets by ticketId", async () => {
      const tickets = await Ticket.find().sort({ ticketId: 1 });
      expect(tickets[0].ticketId).toBe(12345);
      expect(tickets[1].ticketId).toBe(12346);
      expect(tickets[2].ticketId).toBe(12347);
    });

    it("should limit results", async () => {
      const tickets = await Ticket.find().limit(2);
      expect(tickets).toHaveLength(2);
    });
  });
});
