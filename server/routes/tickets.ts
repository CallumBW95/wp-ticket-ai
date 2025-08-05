import express from "express";
import { Ticket } from "../models/Ticket.js";
import { TracScraper } from "../scraper/TracScraper.js";

const router = express.Router();

// Initialize scraper instance
const scraper = new TracScraper();

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
      sortBy,
      order = "desc",
      sortOrder,
    } = req.query;

    // Use sortBy/sortOrder as aliases for sort/order
    const sortField = (sortBy as string) || (sort as string);
    const sortDirection = (sortOrder as string) || (order as string);

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
    sortQuery[sortField] = sortDirection === "desc" ? -1 : 1;

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
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalCount: total,
      },
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
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

    res.json({ tickets });
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

    res.json({ tickets });
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
      summary: {
        totalTickets: totalCount,
      },
      statusDistribution: statusStats,
      priorityDistribution: priorityStats,
      topComponents: componentStats,
    });
  } catch (error) {
    console.error("Error fetching ticket stats:", error);
    res.status(500).json({ error: "Failed to fetch ticket statistics" });
  }
});

// Save a single ticket to the database
router.post("/save", async (req, res) => {
  try {
    const ticketData = req.body;

    if (!ticketData.ticketId) {
      return res.status(400).json({ error: "Ticket ID is required" });
    }

    console.log(`💾 Saving ticket ${ticketData.ticketId} to database`);

    // Check if ticket already exists
    const existingTicket = await Ticket.findOne({
      ticketId: ticketData.ticketId,
    });

    if (existingTicket) {
      // Update existing ticket
      await Ticket.findOneAndUpdate(
        { ticketId: ticketData.ticketId },
        ticketData,
        { new: true }
      );
      console.log(`✅ Updated existing ticket ${ticketData.ticketId}`);
    } else {
      // Create new ticket
      const newTicket = new Ticket(ticketData);
      await newTicket.save();
      console.log(`✅ Created new ticket ${ticketData.ticketId}`);
    }

    res.json({ success: true, message: "Ticket saved successfully" });
  } catch (error) {
    console.error("Error saving ticket:", error);
    res.status(500).json({ error: "Failed to save ticket" });
  }
});

// Fetch ticket with full comment data using scraper
router.get("/scrape/:ticketId", async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);

    if (isNaN(ticketId)) {
      return res.status(400).json({ error: "Invalid ticket ID" });
    }

    console.log(`🔄 Scraping ticket ${ticketId} for full comment data...`);

    // First check if we already have this ticket in the database
    const existingTicket = await Ticket.findOne({ ticketId }).lean();

    // If we have the ticket and it has non-placeholder comments, return it
    if (
      existingTicket &&
      existingTicket.comments &&
      existingTicket.comments.length > 0
    ) {
      const hasRealComments = existingTicket.comments.some(
        (comment: any) =>
          comment.content &&
          !comment.content.includes("Comment history not available") &&
          !comment.content.includes("Visit the ticket URL for full discussion")
      );

      if (hasRealComments) {
        console.log(`✅ Ticket ${ticketId} already has real comment data`);
        return res.json(existingTicket);
      }
    }

    // Use scraper to get fresh data with real comments
    const scrapedTicket = await scraper.scrapeTicket(ticketId);

    if (!scrapedTicket) {
      return res
        .status(404)
        .json({ error: "Ticket not found or inaccessible" });
    }

    // Save or update the ticket with real comment data
    await Ticket.findOneAndUpdate({ ticketId }, scrapedTicket, {
      upsert: true,
      new: true,
    });

    console.log(
      `✅ Successfully scraped ticket ${ticketId} with ${scrapedTicket.comments.length} comments`
    );

    res.json(scrapedTicket);
  } catch (error) {
    console.error(`Error scraping ticket ${req.params.ticketId}:`, error);
    res.status(500).json({ error: "Failed to scrape ticket" });
  }
});

// Get single ticket by ID (must come after specific routes to avoid conflicts)
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

export default router;
