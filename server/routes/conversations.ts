import express from "express";
import {
  ChatConversation,
  IChatConversation,
  IChatMessage,
} from "../models/ChatConversation.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

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
router.get("/:conversationId", async (req, res) => {
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
    const { title, initialMessage } = req.body;

    if (!initialMessage || !initialMessage.content) {
      return res
        .status(400)
        .json({ error: "Initial message content is required" });
    }

    const conversationId = uuidv4();
    const now = new Date();

    const conversation = new ChatConversation({
      conversationId,
      title: title || undefined, // Let it be auto-generated
      messages: [
        {
          role: initialMessage.role || "user",
          content: initialMessage.content,
          timestamp: now,
          ticketsReferenced: initialMessage.ticketsReferenced || [],
          toolsUsed: initialMessage.toolsUsed || [],
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
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Add message to existing conversation
router.post("/:conversationId/messages", async (req, res) => {
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
    });
  } catch (error) {
    console.error("❌ Error adding message:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
});

// Update conversation metadata
router.put("/:conversationId", async (req, res) => {
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
      conversation,
    });
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

// Delete conversation
router.delete("/:conversationId", async (req, res) => {
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

// Search conversations
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    const conversations = await ChatConversation.find(
      {
        $text: { $search: query },
        isArchived: false,
      },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" }, lastActivity: -1 })
      .limit(parseInt(limit as string))
      .select("-messages")
      .lean();

    res.json({ conversations });
  } catch (error) {
    console.error("Error searching conversations:", error);
    res.status(500).json({ error: "Failed to search conversations" });
  }
});

// Export conversations for backup
router.get("/export/:conversationId", async (req, res) => {
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
});

export default router;
