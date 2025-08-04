import express from "express";
import { Ticket } from "../models/Ticket.js";

const router = express.Router();

// Get tickets with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      component,
      milestone,
      type,
      search,
      sort = "updatedAt",
      order = "desc",
    } = req.query;

    const query: any = {};

    // Build filter query
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (component) query.component = component;
    if (milestone) query.milestone = milestone;
    if (type) query.type = type;

    // Text search
    if (search) {
      query.$text = { $search: search as string };
    }

    const sortQuery: any = {};
    sortQuery[sort as string] = order === "desc" ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .select("-comments.content -description") // Exclude large fields for list view
        .lean(),
      Ticket.countDocuments(query),
    ]);

    res.json({
      tickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// Get single ticket by ID
router.get("/:ticketId", async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);

    if (isNaN(ticketId)) {
      return res.status(400).json({ error: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findOne({ ticketId }).lean();

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

// Search tickets by text
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    const tickets = await Ticket.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(parseInt(limit as string))
      .select("ticketId title description status priority component updatedAt")
      .lean();

    res.json(tickets);
  } catch (error) {
    console.error("Error searching tickets:", error);
    res.status(500).json({ error: "Failed to search tickets" });
  }
});

// Get recent tickets
router.get("/recent/:days?", async (req, res) => {
  try {
    const days = parseInt(req.params.days || "7");
    const since = new Date();
    since.setDate(since.getDate() - days);

    const tickets = await Ticket.find({
      updatedAt: { $gte: since },
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select("ticketId title status priority component updatedAt")
      .lean();

    res.json(tickets);
  } catch (error) {
    console.error("Error fetching recent tickets:", error);
    res.status(500).json({ error: "Failed to fetch recent tickets" });
  }
});

// Get ticket statistics
router.get("/stats/summary", async (req, res) => {
  try {
    const [statusStats, priorityStats, componentStats, totalCount] =
      await Promise.all([
        Ticket.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Ticket.aggregate([
          { $group: { _id: "$priority", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Ticket.aggregate([
          { $group: { _id: "$component", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Ticket.countDocuments(),
      ]);

    res.json({
      total: totalCount,
      byStatus: statusStats,
      byPriority: priorityStats,
      topComponents: componentStats,
    });
  } catch (error) {
    console.error("Error fetching ticket stats:", error);
    res.status(500).json({ error: "Failed to fetch ticket statistics" });
  }
});

export default router;
