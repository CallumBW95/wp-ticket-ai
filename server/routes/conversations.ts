import express from "express";
import {
  ChatConversation,
  IChatConversation,
  IChatMessage,
} from "../models/ChatConversation.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Validation middleware for conversation ID format
const validateConversationId = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { conversationId } = req.params;
  
  // Allow both UUID format and simple conversation IDs like "conv-1", "non-existent", etc.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const simpleIdRegex = /^[a-zA-Z0-9-]+$/;
  
  if (conversationId && !uuidRegex.test(conversationId) && !simpleIdRegex.test(conversationId)) {
    return res.status(400).json({ 
      error: "Invalid conversation ID format. Must be a valid UUID or simple ID." 
    });
  }
  
  next();
};

// Get all conversations with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      ticketNumber,
      topic,
      archived = false,
      sortBy = "lastActivity",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query filter
    const filter: any = {
      isArchived: archived === "true",
    };

    // Text search across title and message content
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { "messages.content": { $regex: search, $options: "i" } },
        { topics: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by ticket number
    if (ticketNumber) {
      filter.ticketNumbers = parseInt(ticketNumber as string);
    }

    // Filter by topic
    if (topic) {
      filter.topics = { $regex: topic, $options: "i" };
    }

    // Build sort criteria
    const sortCriteria: any = {};
    sortCriteria[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const conversations = await ChatConversation.find(filter)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limitNum)
      .select("-messages") // Don't include full messages in list view
      .lean();

    // Get total count for pagination
    const totalCount = await ChatConversation.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      conversations,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Search conversations (must be before parameterized routes)
router.get("/search", async (req, res) => {
  try {
    const { q: query, page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      $or: [
        { title: { $regex: query, $options: "i" } },
        { "messages.content": { $regex: query, $options: "i" } },
        { topics: { $regex: query, $options: "i" } },
      ],
      isArchived: false,
    };

    const conversations = await ChatConversation.find(filter)
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limitNum)
      .select("-messages")
      .lean();

    const totalCount = await ChatConversation.countDocuments(filter);

    res.json({
      conversations,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error("Error searching conversations:", error);
    res.status(500).json({ error: "Failed to search conversations" });
  }
});

// Get conversation summary statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await ChatConversation.aggregate([
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          totalMessages: { $sum: "$messageCount" },
          archivedCount: {
            $sum: { $cond: [{ $eq: ["$isArchived", true] }, 1, 0] },
          },
          activeCount: {
            $sum: { $cond: [{ $eq: ["$isArchived", false] }, 1, 0] },
          },
          averageMessagesPerConversation: { $avg: "$messageCount" },
        },
      },
    ]);

    // Get most active topics
    const topicStats = await ChatConversation.aggregate([
      { $unwind: "$topics" },
      { $group: { _id: "$topics", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get most referenced tickets
    const ticketStats = await ChatConversation.aggregate([
      { $unwind: "$ticketNumbers" },
      { $group: { _id: "$ticketNumbers", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      summary: stats[0] || {
        totalConversations: 0,
        totalMessages: 0,
        archivedCount: 0,
        activeCount: 0,
        averageMessagesPerConversation: 0,
      },
      topTopics: topicStats,
      mostReferencedTickets: ticketStats,
    });
  } catch (error) {
    console.error("Error fetching conversation stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Get specific conversation by ID
router.get("/:conversationId", validateConversationId, async (req, res) => {
  try {
    const { conversationId } = req.params;

    console.log("📥 Fetching conversation:", conversationId);

    const conversation = await ChatConversation.findOne({
      conversationId,
    }); // Remove .lean() to return a proper Mongoose document

    if (!conversation) {
      console.error("❌ Conversation not found:", conversationId);
      return res.status(404).json({ error: "Conversation not found" });
    }

    console.log("✅ Conversation retrieved:", {
      conversationId: conversation.conversationId,
      title: conversation.title,
      messageCount: conversation.messageCount,
      actualMessages: conversation.messages.length,
      messages: conversation.messages.map((m) => ({
        role: m.role,
        contentLength: m.content.length,
        timestamp: m.timestamp,
      })),
    });

    res.json(conversation);
  } catch (error) {
    console.error("❌ Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Create new conversation
router.post("/", async (req, res) => {
  try {
    const {
      title,
      initialMessage,
      messages,
      conversationId: customId,
    } = req.body;

    // Handle both initialMessage and messages formats
    let messageData;
    if (initialMessage) {
      messageData = initialMessage;
    } else if (messages && messages.length > 0) {
      messageData = messages[0]; // Use first message as initial
    } else {
      return res
        .status(400)
        .json({ error: "Initial message content is required" });
    }

    if (!messageData.content) {
      return res
        .status(400)
        .json({ error: "Initial message content is required" });
    }

    const conversationId = customId || uuidv4();
    const now = new Date();

    const conversation = new ChatConversation({
      conversationId,
      title: title || undefined, // Let it be auto-generated
      messages: [
        {
          role: messageData.role || "user",
          content: messageData.content,
          timestamp: now,
          ticketsReferenced: messageData.ticketsReferenced || [],
          toolsUsed: messageData.toolsUsed || [],
        },
      ],
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
    });

    await conversation.save();

    res.status(201).json({
      success: true,
      conversationId: conversation.conversationId,
      title: conversation.title,
      messageCount: conversation.messageCount,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Add message to existing conversation
router.post(
  "/:conversationId/messages",
  validateConversationId,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { role, content, ticketsReferenced, toolsUsed } = req.body;

      console.log("📝 Adding message to conversation:", {
        conversationId,
        role,
        contentLength: content.length,
        contentPreview: content.substring(0, 100) + "...",
      });

      if (!role || !content) {
        return res.status(400).json({ error: "Role and content are required" });
      }

      if (!["user", "assistant"].includes(role)) {
        return res
          .status(400)
          .json({ error: "Role must be 'user' or 'assistant'" });
      }

      const conversation = await ChatConversation.findOne({ conversationId });

      if (!conversation) {
        console.error("❌ Conversation not found:", conversationId);
        return res.status(404).json({ error: "Conversation not found" });
      }

      console.log("📋 Conversation before adding message:", {
        conversationId: conversation.conversationId,
        currentMessageCount: conversation.messageCount,
        currentMessages: conversation.messages.length,
      });

      const newMessage: IChatMessage = {
        role,
        content,
        timestamp: new Date(),
        ticketsReferenced: ticketsReferenced || [],
        toolsUsed: toolsUsed || [],
      };

      // Add the new message to the conversation
      conversation.messages.push(newMessage);

      // Update the timestamp - this will trigger the pre-save middleware
      conversation.updatedAt = new Date();

      console.log("💾 Saving conversation with new message...");

      // Save the conversation - this will trigger the pre-save middleware
      // which will update messageCount, lastActivity, ticketNumbers, topics, and title
      await conversation.save();

      console.log("✅ Conversation saved successfully:", {
        conversationId: conversation.conversationId,
        newMessageCount: conversation.messageCount,
        newMessages: conversation.messages.length,
        title: conversation.title,
      });

      res.json({
        success: true,
        message: "Message added successfully",
        messageCount: conversation.messageCount,
        title: conversation.title,
        messages: conversation.messages,
        lastActivity: conversation.lastActivity,
      });
    } catch (error) {
      console.error("❌ Error adding message:", error);
      res.status(500).json({ error: "Failed to add message" });
    }
  }
);

// Update conversation metadata
router.put("/:conversationId", validateConversationId, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title, isArchived } = req.body;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    const conversation = await ChatConversation.findOneAndUpdate(
      { conversationId },
      updateData,
      { new: true, select: "-messages" }
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({
      success: true,
      title: conversation.title,
      isArchived: conversation.isArchived,
      conversation,
    });
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

// Delete conversation
router.delete("/:conversationId", validateConversationId, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await ChatConversation.findOneAndDelete({
      conversationId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// Export conversations for backup
router.get(
  "/:conversationId/export",
  validateConversationId,
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      const conversation = await ChatConversation.findOne({
        conversationId,
      }).lean();

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Format for export
      const exportData = {
        conversationId: conversation.conversationId,
        title: conversation.title,
        messages: conversation.messages,
        ...conversation,
        exportedAt: new Date().toISOString(),
        version: "1.0",
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="conversation-${conversationId}.json"`
      );
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting conversation:", error);
      res.status(500).json({ error: "Failed to export conversation" });
    }
  }
);

export default router;
