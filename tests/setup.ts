import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

// Global test setup
beforeAll(async () => {
  try {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: "7.0.0",
      },
    });

    const mongoUri = mongoServer.getUri();

    // Connect to the in-memory database
    await mongoose.connect(mongoUri);

    // Create text indexes that our schemas expect
    await createTextIndexes();

    console.log("🧪 Test database connected with indexes");
  } catch (error) {
    console.error("Failed to setup test database:", error);
    throw error;
  }
});

// Create text indexes for full-text search
async function createTextIndexes() {
  try {
    const db = mongoose.connection.db;

    // Import models to ensure schemas are registered
    await import("../server/models/Ticket.js");
    await import("../server/models/ChatConversation.js");

    // Wait a bit for schemas to be fully registered
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create text index for tickets collection
    try {
      await db.collection("tickets").createIndex({
        title: "text",
        description: "text",
      });
    } catch (indexError) {
      console.warn("Could not create tickets text index:", indexError.message);
    }

    // Create text index for chatconversations collection
    try {
      await db.collection("chatconversations").createIndex({
        title: "text",
      });
    } catch (indexError) {
      console.warn(
        "Could not create conversations text index:",
        indexError.message
      );
    }

    console.log("📝 Text indexes setup completed for test database");
  } catch (error) {
    console.warn("Warning: Could not create text indexes:", error.message);
  }
}

// Global test teardown
afterAll(async () => {
  try {
    // Close mongoose connection
    await mongoose.connection.close();

    // Stop the in-memory MongoDB instance
    if (mongoServer) {
      await mongoServer.stop();
    }

    console.log("🧪 Test database disconnected");
  } catch (error) {
    console.error("Failed to teardown test database:", error);
  }
});

// Clean up between tests
beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Helper function to get test database connection
export const getTestDatabase = () => mongoose.connection;

// Helper function to create test data
export const createTestData = {
  // Create a test ticket
  async createTicket(overrides: any = {}) {
    const { Ticket } = await import("../server/models/Ticket.js");

    const defaultTicket = {
      ticketId: 12345,
      url: "https://core.trac.wordpress.org/ticket/12345",
      title: "Test Ticket",
      description: "This is a test ticket",
      type: "defect",
      status: "new",
      priority: "normal",
      component: "General",
      reporter: "testuser",
      keywords: ["test"],
      focuses: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      comments: [],
      attachments: [],
      relatedChangesets: [],
      ccList: [],
      blockedBy: [],
      blocking: [],
      ...overrides,
    };

    const ticket = new Ticket(defaultTicket);
    await ticket.save();
    return ticket;
  },

  // Create a test conversation
  async createConversation(overrides: any = {}) {
    const { ChatConversation } = await import(
      "../server/models/ChatConversation.js"
    );
    const { v4: uuidv4 } = await import("uuid");

    const defaultConversation = {
      conversationId: uuidv4(),
      title: overrides.title || "Test Conversation",
      messages: [
        {
          role: "user",
          content: "Hello, I need help with WordPress",
          timestamp: new Date(),
          ticketsReferenced: [],
          toolsUsed: [],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 1,
      isArchived: false,
      ...overrides,
    };

    // Only set ticketNumbers and topics if explicitly provided in overrides
    // Otherwise, let the pre-save middleware extract them from messages
    if (overrides.ticketNumbers !== undefined) {
      defaultConversation.ticketNumbers = overrides.ticketNumbers;
    }
    if (overrides.topics !== undefined) {
      defaultConversation.topics = overrides.topics;
    }

    const conversation = new ChatConversation(defaultConversation);
    await conversation.save();
    return conversation;
  },
};
