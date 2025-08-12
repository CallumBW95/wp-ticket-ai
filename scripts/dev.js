#!/usr/bin/env node

import { spawn } from "child_process";
import { createServer } from "net";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort, maxAttempts = 10) {
  if (startPort < 1 || startPort > 65535) {
    throw new Error(
      `Invalid start port: ${startPort}. Port must be between 1 and 65535.`
    );
  }

  if (maxAttempts < 1 || maxAttempts > 100) {
    throw new Error(
      `Invalid max attempts: ${maxAttempts}. Must be between 1 and 100.`
    );
  }

  console.log(`🔍 Searching for available port starting from ${startPort}...`);

  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;

    try {
      await new Promise((resolve, reject) => {
        const server = createServer();

        server.listen(port, () => {
          server.close();
          resolve();
        });

        server.on("error", (err) => {
          if (err.code === "EADDRINUSE") {
            reject(new Error(`Port ${port} is in use`));
          } else {
            reject(err);
          }
        });
      });

      console.log(`✅ Found available port: ${port}`);
      return port;
    } catch (error) {
      if (i === maxAttempts - 1) {
        const endPort = startPort + maxAttempts - 1;
        throw new Error(
          `❌ No available ports found in range ${startPort}-${endPort}!\n` +
            `🔧 All ports in this range are currently in use.\n` +
            `💡 Try:\n` +
            `   1. Stopping other services using these ports\n` +
            `   2. Using a different port range\n` +
            `   3. Setting a custom port via environment variables`
        );
      }
      console.log(`⚠️  Port ${port} is in use, trying next port...`);
    }
  }

  throw new Error("Unexpected error in port finding logic");
}

/**
 * Start the development environment with dynamic port handling
 */
async function startDev() {
  try {
    console.log("🚀 Starting WP Aggregator AI Development Environment...");
    console.log("📅 Started at:", new Date().toISOString());
    console.log("🌍 Environment: development");
    console.log("");

    // Check for custom ports in environment variables
    const customFrontendPort =
      process.env.FRONTEND_PORT || process.env.VITE_PORT;
    const customBackendPort = process.env.BACKEND_PORT || process.env.PORT;

    // Find available ports for frontend and backend
    let frontendPort, backendPort;

    if (customFrontendPort) {
      // Use custom frontend port if specified
      frontendPort = parseInt(customFrontendPort);
      console.log(`📱 Using custom frontend port: ${frontendPort}`);
    } else {
      // Find available frontend port starting from 3000
      console.log("🔍 Finding available frontend port...");
      frontendPort = await findAvailablePort(3000);
      console.log(`📱 Frontend will run on port ${frontendPort}`);
    }

    if (customBackendPort) {
      // Use custom backend port if specified
      backendPort = parseInt(customBackendPort);
      console.log(`🔧 Using custom backend port: ${backendPort}`);
    } else {
      // Find available backend port starting from 3001
      console.log("🔍 Finding available backend port...");
      backendPort = await findAvailablePort(3001);
      console.log(`🔧 Backend will run on port ${backendPort}`);
    }

    console.log("");
    console.log("⚙️  Configuration:");
    console.log(`   Frontend: http://localhost:${frontendPort}`);
    console.log(`   Backend:  http://localhost:${backendPort}`);
    console.log("");

    // Set environment variables for the processes
    const env = {
      ...process.env,
      VITE_API_BASE_URL: `http://localhost:${backendPort}`,
      PORT: backendPort.toString(),
      VITE_FRONTEND_PORT: frontendPort.toString(),
    };

    // Start backend server
    console.log("🔧 Starting backend server...");
    const backend = spawn("npm", ["run", "server"], {
      stdio: "pipe",
      env,
      cwd: path.resolve(__dirname, ".."),
    });

    backend.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`🔧 Backend: ${output.trim()}`);
    });

    backend.stderr.on("data", (data) => {
      const output = data.toString();
      console.error(`🔧 Backend Error: ${output.trim()}`);
    });

    // Wait for backend to start and report its port
    let backendReady = false;
    let backendPortReady = false;

    backend.stdout.on("data", (data) => {
      const output = data.toString();
      if (output.includes("PORT_READY")) {
        backendPortReady = true;
        console.log("✅ Backend port is ready");
      }
      if (output.includes("Server is ready to handle requests")) {
        backendReady = true;
        console.log("✅ Backend server is ready");
      }
    });

    // Wait for backend to be ready
    console.log("⏳ Waiting for backend to start...");
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "Backend startup timeout - server didn't start within 30 seconds"
          )
        );
      }, 30000);

      const checkReady = () => {
        if (backendReady && backendPortReady) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });

    // Start frontend with custom port
    console.log("📱 Starting frontend...");
    const frontend = spawn("npx", ["vite", "--port", frontendPort.toString()], {
      stdio: "pipe",
      env,
      cwd: path.resolve(__dirname, ".."),
    });

    frontend.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`📱 Frontend: ${output.trim()}`);
    });

    frontend.stderr.on("data", (data) => {
      const output = data.toString();
      console.error(`📱 Frontend Error: ${output.trim()}`);
    });

    // Wait for frontend to be ready
    await new Promise((resolve) => {
      frontend.stdout.on("data", (data) => {
        const output = data.toString();
        if (output.includes("Local:") || output.includes("ready in")) {
          console.log("✅ Frontend is ready");
          resolve();
        }
      });
    });

    console.log("");
    console.log("🎉 Development environment is ready!");
    console.log(`📱 Frontend: http://localhost:${frontendPort}`);
    console.log(`🔧 Backend:  http://localhost:${backendPort}`);
    console.log("💚 Health check: http://localhost:${backendPort}/health");
    console.log("");
    console.log("🔄 Press Ctrl+C to stop all services");

    // Handle process termination
    const cleanup = () => {
      console.log("\n🛑 Shutting down development environment...");

      if (backend && !backend.killed) {
        backend.kill();
        console.log("✅ Backend stopped");
      }

      if (frontend && !frontend.killed) {
        frontend.kill();
        console.log("✅ Frontend stopped");
      }

      console.log("👋 Development environment shutdown complete");
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Handle process errors
    backend.on("error", (error) => {
      console.error("❌ Backend process error:", error);
      cleanup();
    });

    frontend.on("error", (error) => {
      console.error("❌ Frontend process error:", error);
      cleanup();
    });

    // Handle process exit
    backend.on("exit", (code) => {
      if (code !== 0) {
        console.error(`❌ Backend process exited with code ${code}`);
        console.error(
          "🔧 This usually means there was an error starting the backend server"
        );
        console.error("💡 Check the error messages above for details");
        cleanup();
      }
    });

    frontend.on("exit", (code) => {
      if (code !== 0) {
        console.error(`❌ Frontend process exited with code ${code}`);
        console.error(
          "🔧 This usually means there was an error starting the frontend"
        );
        console.error("💡 Check the error messages above for details");
        cleanup();
      }
    });
  } catch (error) {
    console.error(
      "❌ CRITICAL ERROR: Failed to start development environment!"
    );
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
      "🚫 Development environment startup failed. Please check the error details above and try again."
    );
    process.exit(1);
  }
}

// Run the development script
startDev();
