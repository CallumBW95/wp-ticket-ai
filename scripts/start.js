#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Start the production server with improved error handling
 */
async function startProduction() {
  try {
    console.log("🚀 Starting WP Aggregator AI Production Server...");
    console.log("📅 Started at:", new Date().toISOString());
    console.log("🌍 Environment: production");
    console.log("");

    // Start the server
    console.log("🔧 Starting server...");
    const server = spawn("npm", ["run", "server"], {
      stdio: "pipe",
      cwd: path.resolve(__dirname, ".."),
    });

    server.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`🔧 Server: ${output.trim()}`);
    });

    server.stderr.on("data", (data) => {
      const output = data.toString();
      console.error(`🔧 Server Error: ${output.trim()}`);
    });

    // Wait for server to be ready
    let serverReady = false;

    server.stdout.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Server is ready to handle requests")) {
        serverReady = true;
        console.log("✅ Server is ready");
      }
    });

    // Wait for server to be ready
    console.log("⏳ Waiting for server to start...");
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "Server startup timeout - server didn't start within 30 seconds"
          )
        );
      }, 30000);

      const checkReady = () => {
        if (serverReady) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });

    console.log("");
    console.log("🎉 Production server is ready!");
    console.log("🔄 Press Ctrl+C to stop the server");

    // Handle process termination
    const cleanup = () => {
      console.log("\n🛑 Shutting down production server...");

      if (server && !server.killed) {
        server.kill();
        console.log("✅ Server stopped");
      }

      console.log("👋 Production server shutdown complete");
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Handle process errors
    server.on("error", (error) => {
      console.error("❌ Server process error:", error);
      cleanup();
    });

    // Handle process exit
    server.on("exit", (code) => {
      if (code !== 0) {
        console.error(`❌ Server process exited with code ${code}`);
        console.error(
          "🔧 This usually means there was an error starting the server"
        );
        console.error("💡 Check the error messages above for details");
        cleanup();
      }
    });
  } catch (error) {
    console.error("❌ CRITICAL ERROR: Failed to start production server!");
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
      "🚫 Production server startup failed. Please check the error details above and try again."
    );
    process.exit(1);
  }
}

// Run the production startup script
startProduction();
