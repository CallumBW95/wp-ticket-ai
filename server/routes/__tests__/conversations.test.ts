import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import express from "express";
import { ChatConversation } from "../../models/ChatConversation";
import conversationsRouter from "../conversations";

const app = express();
app.use(express.json());
app.use("/api/conversations", conversationsRouter);

describe("Conversations API", () => {
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
    await mongoose.connection.db.collection("chatconversations").deleteMany({});
  });

  describe("GET /", () => {
    beforeEach(async () => {
      const conversations = [
        {
          conversationId: "conv-1",
          title: "WordPress Development Discussion",
          messages: [
            {
              role: "user",
              content: "Tell me about WordPress development",
              timestamp: new Date("2023-01-01"),
            },
            {
              role: "assistant",
              content: "WordPress is a popular CMS...",
              timestamp: new Date("2023-01-01"),
            },
          ],
          messageCount: 2,
          lastActivity: new Date("2023-01-01"),
          ticketNumbers: [12345],
          topics: ["WordPress", "Development"],
          createdAt: new Date("2023-01-01"),
        },
        {
          conversationId: "conv-2",
          title: "Plugin Development Help",
          messages: [
            {
              role: "user",
              content: "How do I create a WordPress plugin?",
              timestamp: new Date("2023-01-02"),
            },
          ],
          messageCount: 1,
          lastActivity: new Date("2023-01-02"),
          ticketNumbers: [],
          topics: ["Plugin", "Development"],
          createdAt: new Date("2023-01-02"),
        },
      ];

      await ChatConversation.insertMany(conversations);
    });

    it("should return all conversations", async () => {
      const response = await request(app).get("/api/conversations/");

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/conversations/")
        .query({ page: 1, limit: 1 });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(1);
    });

    it("should support filtering by ticket number", async () => {
      const response = await request(app)
        .get("/api/conversations/")
        .query({ ticketNumber: 12345 });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].ticketNumbers).toContain(12345);
    });

    it("should support filtering by topic", async () => {
      const response = await request(app)
        .get("/api/conversations/")
        .query({ topic: "WordPress" });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].topics).toContain("WordPress");
    });

    it("should support text search", async () => {
      const response = await request(app)
        .get("/api/conversations/")
        .query({ search: "WordPress Development" });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].title).toContain("WordPress");
    });

    it("should support sorting by lastActivity", async () => {
      const response = await request(app)
        .get("/api/conversations/")
        .query({ sortBy: "lastActivity", sortOrder: "desc" });

      expect(response.status).toBe(200);
      expect(new Date(response.body.conversations[0].lastActivity)).toEqual(
        new Date("2023-01-02")
      );
    });

    it("should support sorting by createdAt", async () => {
      const response = await request(app)
        .get("/api/conversations/")
        .query({ sortBy: "createdAt", sortOrder: "asc" });

      expect(response.status).toBe(200);
      expect(new Date(response.body.conversations[0].createdAt)).toEqual(
        new Date("2023-01-01")
      );
    });
  });

  describe("GET /:conversationId", () => {
    beforeEach(async () => {
      const conversation = new ChatConversation({
        conversationId: "conv-1",
        title: "Test Conversation",
        messages: [
          {
            role: "user",
            content: "Hello",
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content: "Hi there!",
            timestamp: new Date(),
          },
        ],
        messageCount: 2,
        lastActivity: new Date(),
        ticketNumbers: [12345],
        topics: ["Test"],
      });

      await conversation.save();
    });

    it("should return a specific conversation", async () => {
      const response = await request(app).get("/api/conversations/conv-1");

      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBe("conv-1");
      expect(response.body.title).toBe("Test Conversation");
      expect(response.body.messages).toHaveLength(2);
    });

    it("should return 404 for non-existent conversation", async () => {
      const response = await request(app).get(
        "/api/conversations/non-existent"
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Conversation not found");
    });
  });

  describe("POST /", () => {
    it("should create a new conversation", async () => {
      const conversationData = {
        conversationId: "conv-new",
        title: "New Conversation",
        messages: [
          {
            role: "user",
            content: "First message",
            timestamp: new Date(),
          },
        ],
      };

      const response = await request(app)
        .post("/api/conversations/")
        .send(conversationData);

      expect(response.status).toBe(201);
      expect(response.body.conversationId).toBe("conv-new");
      expect(response.body.title).toBe("New Conversation");
      expect(response.body.messageCount).toBe(1);

      // Verify conversation was saved to database
      const savedConversation = await ChatConversation.findOne({
        conversationId: "conv-new",
      });
      expect(savedConversation).toBeDefined();
      expect(savedConversation?.title).toBe("New Conversation");
    });

    it("should auto-generate title if not provided", async () => {
      const conversationData = {
        conversationId: "conv-auto-title",
        messages: [
          {
            role: "user",
            content: "Tell me about ticket #12345",
            timestamp: new Date(),
          },
        ],
      };

      const response = await request(app)
        .post("/api/conversations/")
        .send(conversationData);

      expect(response.status).toBe(201);
      expect(response.body.title).toBeDefined();
      expect(response.body.title).toContain("12345");
    });

    it("should validate required fields", async () => {
      const invalidData = {
        title: "Test Conversation",
        // Missing conversationId and messages
      };

      const response = await request(app)
        .post("/api/conversations/")
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("PUT /:conversationId", () => {
    beforeEach(async () => {
      const conversation = new ChatConversation({
        conversationId: "conv-update",
        title: "Original Title",
        messages: [
          {
            role: "user",
            content: "Original message",
            timestamp: new Date(),
          },
        ],
        messageCount: 1,
        lastActivity: new Date(),
      });

      await conversation.save();
    });

    it("should update an existing conversation", async () => {
      const updateData = {
        title: "Updated Title",
        isArchived: true,
      };

      const response = await request(app)
        .put("/api/conversations/conv-update")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe("Updated Title");
      expect(response.body.isArchived).toBe(true);

      // Verify conversation was updated in database
      const updatedConversation = await ChatConversation.findOne({
        conversationId: "conv-update",
      });
      expect(updatedConversation?.title).toBe("Updated Title");
      expect(updatedConversation?.isArchived).toBe(true);
    });

    it("should return 404 for non-existent conversation", async () => {
      const updateData = {
        title: "Updated Title",
      };

      const response = await request(app)
        .put("/api/conversations/non-existent")
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Conversation not found");
    });
  });

  describe("POST /:conversationId/messages", () => {
    beforeEach(async () => {
      const conversation = new ChatConversation({
        conversationId: "conv-messages",
        title: "Test Conversation",
        messages: [
          {
            role: "user",
            content: "First message",
            timestamp: new Date(),
          },
        ],
        messageCount: 1,
        lastActivity: new Date(),
      });

      await conversation.save();
    });

    it("should add a message to conversation", async () => {
      const messageData = {
        role: "assistant",
        content: "New message",
        timestamp: new Date(),
      };

      const response = await request(app)
        .post("/api/conversations/conv-messages/messages")
        .send(messageData);

      expect(response.status).toBe(200);
      expect(response.body.messageCount).toBe(2);
      expect(response.body.messages).toHaveLength(2);

      // Verify message was added to database
      const updatedConversation = await ChatConversation.findOne({
        conversationId: "conv-messages",
      });
      expect(updatedConversation?.messages).toHaveLength(2);
      expect(updatedConversation?.messageCount).toBe(2);
    });

    it("should update lastActivity when adding message", async () => {
      const originalConversation = await ChatConversation.findOne({
        conversationId: "conv-messages",
      });
      const originalLastActivity = originalConversation?.lastActivity;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageData = {
        role: "user",
        content: "Another message",
        timestamp: new Date(),
      };

      const response = await request(app)
        .post("/api/conversations/conv-messages/messages")
        .send(messageData);

      expect(response.status).toBe(200);
      expect(new Date(response.body.lastActivity).getTime()).toBeGreaterThan(
        originalLastActivity!.getTime()
      );
    });

    it("should return 404 for non-existent conversation", async () => {
      const messageData = {
        role: "user",
        content: "Test message",
        timestamp: new Date(),
      };

      const response = await request(app)
        .post("/api/conversations/non-existent/messages")
        .send(messageData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Conversation not found");
    });

    it("should validate message data", async () => {
      const invalidMessageData = {
        content: "Test message",
        // Missing role and timestamp
      };

      const response = await request(app)
        .post("/api/conversations/conv-messages/messages")
        .send(invalidMessageData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("DELETE /:conversationId", () => {
    beforeEach(async () => {
      const conversation = new ChatConversation({
        conversationId: "conv-delete",
        title: "Test Conversation",
        messages: [
          {
            role: "user",
            content: "Test message",
            timestamp: new Date(),
          },
        ],
        messageCount: 1,
        lastActivity: new Date(),
      });

      await conversation.save();
    });

    it("should delete a conversation", async () => {
      const response = await request(app).delete(
        "/api/conversations/conv-delete"
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Conversation deleted successfully");

      // Verify conversation was deleted from database
      const deletedConversation = await ChatConversation.findOne({
        conversationId: "conv-delete",
      });
      expect(deletedConversation).toBeNull();
    });

    it("should return 404 for non-existent conversation", async () => {
      const response = await request(app).delete(
        "/api/conversations/non-existent"
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Conversation not found");
    });
  });

  describe("GET /search", () => {
    beforeEach(async () => {
      const conversations = [
        {
          conversationId: "conv-search-1",
          title: "WordPress Core Development",
          messages: [
            {
              role: "user",
              content: "How do I contribute to WordPress core?",
              timestamp: new Date(),
            },
          ],
          messageCount: 1,
          lastActivity: new Date(),
          topics: ["WordPress", "Core", "Development"],
        },
        {
          conversationId: "conv-search-2",
          title: "Plugin API Discussion",
          messages: [
            {
              role: "user",
              content: "Tell me about WordPress plugin APIs",
              timestamp: new Date(),
            },
          ],
          messageCount: 1,
          lastActivity: new Date(),
          topics: ["Plugin", "API"],
        },
      ];

      await ChatConversation.insertMany(conversations);
    });

    it("should search conversations by query", async () => {
      const response = await request(app)
        .get("/api/conversations/search")
        .query({ q: "WordPress core" });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].title).toContain("WordPress Core");
    });

    it("should return empty results for no matches", async () => {
      const response = await request(app)
        .get("/api/conversations/search")
        .query({ q: "nonexistent term" });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(0);
    });

    it("should support pagination in search", async () => {
      const response = await request(app)
        .get("/api/conversations/search")
        .query({ q: "WordPress", page: 1, limit: 1 });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.total).toBeGreaterThan(0);
    });
  });

  describe("GET /:conversationId/export", () => {
    beforeEach(async () => {
      const conversation = new ChatConversation({
        conversationId: "conv-export",
        title: "Export Test Conversation",
        messages: [
          {
            role: "user",
            content: "Hello",
            timestamp: new Date("2023-01-01T10:00:00Z"),
          },
          {
            role: "assistant",
            content: "Hi there!",
            timestamp: new Date("2023-01-01T10:01:00Z"),
          },
        ],
        messageCount: 2,
        lastActivity: new Date(),
        ticketNumbers: [12345],
        topics: ["Test"],
      });

      await conversation.save();
    });

    it("should export conversation as JSON", async () => {
      const response = await request(app).get(
        "/api/conversations/conv-export/export"
      );

      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBe("conv-export");
      expect(response.body.title).toBe("Export Test Conversation");
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.ticketNumbers).toEqual([12345]);
      expect(response.body.topics).toEqual(["Test"]);
    });

    it("should return 404 for non-existent conversation", async () => {
      const response = await request(app).get(
        "/api/conversations/non-existent/export"
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Conversation not found");
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors", async () => {
      // Temporarily disconnect from database
      await mongoose.disconnect();

      const response = await request(app).get("/api/conversations/");

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();

      // Reconnect for cleanup
      await mongoose.connect(mongoServer.getUri());
    });

    it("should handle malformed JSON in POST requests", async () => {
      const response = await request(app)
        .post("/api/conversations/")
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("should handle invalid conversation ID format", async () => {
      const response = await request(app).get(
        "/api/conversations/invalid-id-format"
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});
