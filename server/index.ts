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
import mongoose from "mongoose";

// Validate critical environment variables
function validateEnvironment() {
  console.log("🔍 Validating environment configuration...");

  const requiredEnvVars = ["MONGODB_URI"];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error("❌ CRITICAL ERROR: Missing required environment variables!");
    console.error("");
    console.error("🔧 Missing variables:", missingVars.join(", "));
    console.error("");
    console.error("💡 To fix this:");
    console.error("   1. Create a .env file in your project root");
    console.error("   2. Add the missing variables");
    console.error("   3. See .env.example for reference");
    console.error("");
    process.exit(1);
  }

  // Validate optional environment variables
  if (process.env.GEMINI_API_KEY) {
    console.log("✅ GEMINI_API_KEY is set");
  } else {
    console.warn(
      "⚠️  GEMINI_API_KEY is not set - AI features will be disabled"
    );
  }

  if (process.env.ENABLE_SCRAPING === "true") {
    console.log("✅ ENABLE_SCRAPING is enabled");
  } else {
    console.log("ℹ️  ENABLE_SCRAPING is disabled (default)");
  }

  console.log("✅ Environment validation passed");
}

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
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
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
    console.error("❌ API Error:", err);
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
    console.log("🚀 Starting WP Aggregator AI Server...");
    console.log("📅 Started at:", new Date().toISOString());
    console.log("🌍 Environment:", process.env.NODE_ENV || "development");
    console.log("");

    // Validate environment first
    validateEnvironment();
    console.log("");

    // Connect to database
    console.log("🔌 Connecting to database...");
    await connectToDatabase();
    console.log("");

    // Find an available port
    console.log("🔍 Finding available port...");
    const port = await findPort();
    console.log("");

    // Start the server
    const server = app.listen(port, () => {
      console.log("🎉 Server startup completed successfully!");
      console.log(`🚀 Server running on http://localhost:${port}`);
      console.log(`📚 API available at http://localhost:${port}/api`);
      console.log(`💚 Health check at http://localhost:${port}/health`);
      console.log("");

      // Log the port for other processes to use
      if (process.send) {
        process.send({ type: "PORT_READY", port });
      }
    });

    // Start the scraping scheduler (only in production or when explicitly enabled)
    if (process.env.ENABLE_SCRAPING === "true") {
      console.log("⏰ Starting scraping scheduler...");
      startScrapingScheduler();
      console.log("✅ Scraping scheduler started");
    } else {
      console.log(
        "⏸️  Scraping scheduler disabled. Set ENABLE_SCRAPING=true to enable."
      );
    }

    console.log("");
    console.log("🎯 Server is ready to handle requests!");

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      // Close the HTTP server
      server.close(() => {
        console.log("✅ HTTP server closed");
      });

      // Close database connection
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log("✅ Database connection closed");
      }

      console.log("👋 Server shutdown complete");
      process.exit(0);
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("❌ CRITICAL ERROR: Failed to start server!");
    console.error("");
    console.error(
      "🔍 Error details:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("");

    if (error instanceof Error && error.stack) {
      console.error("📚 Stack trace:");
      console.error(error.stack);
    }

    console.error("");
    console.error(
      "🚫 Server startup failed. Please check the error details above and try again."
    );
    process.exit(1);
  }
}

startServer();
