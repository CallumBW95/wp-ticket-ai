import { ChatConversation } from "../ChatConversation.js";
import { createTestData } from "../../../tests/setup.js";
import { v4 as uuidv4 } from "uuid";

describe("ChatConversation Model", () => {
  describe("Validation", () => {
    it("should create a valid conversation", async () => {
      const conversationData = {
        conversationId: uuidv4(),
        title: "Test Conversation",
        ticketNumbers: [12345],
        topics: ["WordPress", "Development"],
        messages: [
          {
            role: "user" as const,
            content:
              "Hello, I need help with WordPress development for ticket #12345",
            timestamp: new Date(),
            ticketsReferenced: [12345],
            toolsUsed: [],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 1,
        isArchived: false,
      };

      const conversation = new ChatConversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();

      expect(conversation.conversationId).toBe(conversationData.conversationId);
      expect(conversation.title).toBe("Test Conversation");
      expect(conversation.ticketNumbers).toEqual([12345]);
      expect(conversation.topics).toEqual(["WordPress", "Development"]);
      expect(conversation.messageCount).toBe(1);
    });

    it("should require conversationId", async () => {
      const conversation = new ChatConversation({
        title: "Test Conversation",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        isArchived: false,
      });

      await expect(conversation.save()).rejects.toThrow("conversationId");
    });

    it("should validate message role enum", async () => {
      const conversation = new ChatConversation({
        conversationId: uuidv4(),
        title: "Test Conversation",
        messages: [
          {
            role: "invalid-role" as any,
            content: "This should fail",
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 1,
        isArchived: false,
      });

      await expect(conversation.save()).rejects.toThrow();
    });

    it("should enforce unique conversationId", async () => {
      const conversationId = uuidv4();
      await createTestData.createConversation({ conversationId });

      const duplicateConversation = new ChatConversation({
        conversationId,
        title: "Duplicate Conversation",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        isArchived: false,
      });

      await expect(duplicateConversation.save()).rejects.toThrow();
    });
  });

  describe("Methods", () => {
    it("should extract ticket numbers from content", async () => {
      const conversation = new ChatConversation({
        conversationId: uuidv4(),
        title: "Test",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        isArchived: false,
      });

      const content1 = "I need help with ticket #12345 and #67890";
      const content2 = "Check out ticket 11111 and ticket #22222";
      const content3 = "No tickets here";

      expect(conversation.extractTicketNumbers(content1)).toEqual([
        12345, 67890,
      ]);
      expect(conversation.extractTicketNumbers(content2)).toEqual([
        11111, 22222,
      ]);
      expect(conversation.extractTicketNumbers(content3)).toEqual([]);
    });

    it("should extract topics from conversations", async () => {
      const conversation = new ChatConversation({
        conversationId: uuidv4(),
        title: "Test",
        messages: [
          {
            role: "user",
            content: "I need help with WordPress blocks and theme development",
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content: "Sure! I can help with Gutenberg blocks and PHP functions",
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 2,
        isArchived: false,
      });

      const topics = conversation.extractTopics();
      expect(topics).toContain("Blocks");
      expect(topics).toContain("Themes");
      expect(topics).toContain("PHP Development");
    });

    it("should generate title from ticket numbers", async () => {
      const conversation = new ChatConversation({
        conversationId: uuidv4(),
        title: "",
        ticketNumbers: [],
        topics: [],
        messages: [
          {
            role: "user",
            content: "Can you help me with ticket #12345?",
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 1,
        isArchived: false,
      });

      const title = conversation.generateTitle();
      expect(title).toBe("Discussion: Ticket #12345");
    });

    it("should generate title from multiple ticket numbers", async () => {
      const conversation = new ChatConversation({
        conversationId: uuidv4(),
        title: "",
        ticketNumbers: [],
        topics: [],
        messages: [
          {
            role: "user",
            content: "I need help with tickets #12345, #67890, and #11111",
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 1,
        isArchived: false,
      });

      const title = conversation.generateTitle();
      expect(title).toBe("Discussion: Tickets #11111, #12345, #67890");
    });

    it("should generate title from topics when no tickets", async () => {
      const conversation = new ChatConversation({
        conversationId: uuidv4(),
        title: "",
        ticketNumbers: [],
        topics: ["Blocks", "Themes"],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        isArchived: false,
      });

      const title = conversation.generateTitle();
      expect(title).toBe("WordPress Discussion: Blocks");
    });

    it("should generate title from first message when no tickets or topics", async () => {
      const conversation = new ChatConversation({
        conversationId: uuidv4(),
        title: "",
        ticketNumbers: [],
        topics: [],
        messages: [
          {
            role: "user",
            content: "How do I create a custom WordPress theme?",
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 1,
        isArchived: false,
      });

      const title = conversation.generateTitle();
      expect(title).toBe("How do I create a custom WordPress theme?");
    });

    it("should not include referenced tickets from assistant messages in title", async () => {
      const conversation = new ChatConversation({
        conversationId: uuidv4(),
        title: "",
        ticketNumbers: [],
        topics: [],
        messages: [
          {
            role: "user",
            content: "Can you help me with ticket #12345?",
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content: "Sure! I can help with ticket #12345. This is related to tickets #99999 and #88888 that were mentioned in the discussion.",
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 2,
        isArchived: false,
      });

      const title = conversation.generateTitle();
      // Should only include ticket #12345 from user message, not #99999 or #88888 from assistant
      expect(title).toBe("Discussion: Ticket #12345");
    });
  });

  describe("Pre-save Middleware", () => {
    it("should auto-update computed fields on save", async () => {
      const conversationId = uuidv4();
      const conversation = new ChatConversation({
        conversationId,
        title: "",
        messages: [
          {
            role: "user",
            content: "Help with ticket #12345 and WordPress blocks",
            timestamp: new Date(),
          },
          {
            role: "assistant",
            content:
              "Sure! I can help with that ticket and Gutenberg development",
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date("2023-01-01"), // Old date
        messageCount: 0, // Wrong count
        isArchived: false,
      });

      await conversation.save();

      // Check computed fields were updated
      expect(conversation.messageCount).toBe(2);
      expect(conversation.ticketNumbers).toEqual([12345]);
      expect(conversation.topics).toContain("Blocks");
      expect(conversation.title).toContain("Ticket #12345");
      expect(conversation.lastActivity.getTime()).toBeGreaterThan(
        new Date("2023-01-01").getTime()
      );
    });
  });

  describe("Queries", () => {
    beforeEach(async () => {
      // Create test conversations with messages that contain the expected data
      await createTestData.createConversation({
        conversationId: "conv-1",
        title: "WordPress Blocks Discussion",
        messages: [
          {
            role: "user",
            content: "Help with ticket #12345 and WordPress blocks development",
            timestamp: new Date(),
            ticketsReferenced: [],
            toolsUsed: [],
          },
          {
            role: "assistant",
            content: "I can help you with ticket #12345 and Gutenberg blocks",
            timestamp: new Date(),
            ticketsReferenced: [],
            toolsUsed: [],
          },
        ],
        isArchived: false,
      });

      await createTestData.createConversation({
        conversationId: "conv-2",
        title: "Theme Development Help",
        messages: [
          {
            role: "user",
            content: "I need help with WordPress theme development",
            timestamp: new Date(),
            ticketsReferenced: [],
            toolsUsed: [],
          },
        ],
        isArchived: false,
      });

      await createTestData.createConversation({
        conversationId: "conv-3",
        title: "Old Archived Chat",
        messages: [
          {
            role: "user",
            content: "Help with ticket #67890 and performance optimization",
            timestamp: new Date(),
            ticketsReferenced: [],
            toolsUsed: [],
          },
        ],
        isArchived: true,
      });
    });

    it("should find conversations by ticket number", async () => {
      const conversations = await ChatConversation.find({
        ticketNumbers: 12345,
      });
      expect(conversations).toHaveLength(1);
      expect(conversations[0].conversationId).toBe("conv-1");
    });

    it("should find conversations by topic", async () => {
      const conversations = await ChatConversation.find({ topics: "Blocks" });
      expect(conversations).toHaveLength(1);
      expect(conversations[0].conversationId).toBe("conv-1");
    });

    it("should find non-archived conversations", async () => {
      const conversations = await ChatConversation.find({ isArchived: false });
      expect(conversations).toHaveLength(2);
      expect(conversations.map((c) => c.conversationId)).toContain("conv-1");
      expect(conversations.map((c) => c.conversationId)).toContain("conv-2");
    });

    it("should support text search", async () => {
      const conversations = await ChatConversation.find({
        $text: { $search: "Blocks" },
      });
      expect(conversations).toHaveLength(1);
      expect(conversations[0].conversationId).toBe("conv-1");
    });
  });
});
