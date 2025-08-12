// Load environment variables first
import dotenv from "dotenv";
import path from "path";

// Load .env from current working directory (where npm scripts are executed)
dotenv.config({ path: path.join(process.cwd(), ".env") });

import express from "express";
import { connectToDatabase } from "./config/database.js";
import ticketRoutes from "./routes/tickets.js";
import mcpRoutes from "./routes/mcp.js";
import conversationRoutes from "./routes/conversations.js";
import { startScrapingScheduler } from "./scraper/scheduler.js";
import { findPort } from "./utils/portFinder.js";

const app = express();

// Middleware
app.use((req, res, next) => {
  const allowedOrigins =
    process.env.NODE_ENV === "production"
      ? ["https://your-domain.com"] // Replace with your production domain
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:3003",
          "http://localhost:3004",
          "http://localhost:3005",
        ];

  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/tickets", ticketRoutes);
app.use("/api/mcp", mcpRoutes);
app.use("/api/conversations", conversationRoutes);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("API Error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
  }
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

async function startServer() {
  try {
    // Connect to database
    await connectToDatabase();

    // Find an available port
    const port = await findPort();

    // Start the server
    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
      console.log(`📚 API available at http://localhost:${port}/api`);

      // Log the port for other processes to use
      if (process.send) {
        process.send({ type: "PORT_READY", port });
      }
    });

    // Start the scraping scheduler (only in production or when explicitly enabled)
    if (process.env.ENABLE_SCRAPING === "true") {
      startScrapingScheduler();
    } else {
      console.log(
        "⏸️  Scraping scheduler disabled. Set ENABLE_SCRAPING=true to enable."
      );
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
