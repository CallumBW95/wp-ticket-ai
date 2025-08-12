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

      return port;
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error(
          `No available ports found in range ${startPort}-${
            startPort + maxAttempts - 1
          }`
        );
      }
    }
  }

  throw new Error(
    `No available ports found in range ${startPort}-${
      startPort + maxAttempts - 1
    }`
  );
}

/**
 * Start the development environment with dynamic port handling
 */
async function startDev() {
  try {
    console.log("🚀 Starting development environment...");

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
      frontendPort = await findAvailablePort(3000);
      console.log(`📱 Frontend will run on port ${frontendPort}`);
    }

    if (customBackendPort) {
      // Use custom backend port if specified
      backendPort = parseInt(customBackendPort);
      console.log(`🔧 Using custom backend port: ${backendPort}`);
    } else {
      // Find available backend port starting from 3001
      backendPort = await findAvailablePort(3001);
      console.log(`🔧 Backend will run on port ${backendPort}`);
    }

    // Set environment variables for the processes
    const env = {
      ...process.env,
      VITE_API_BASE_URL: `http://localhost:${backendPort}`,
      PORT: backendPort.toString(),
      VITE_FRONTEND_PORT: frontendPort.toString(),
    };

    // Start backend server
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

    // Wait a moment for backend to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start frontend with custom port
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

    // Handle process termination
    const cleanup = () => {
      console.log("\n🛑 Shutting down development environment...");
      backend.kill();
      frontend.kill();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Handle process errors
    backend.on("error", (error) => {
      console.error("Backend process error:", error);
      cleanup();
    });

    frontend.on("error", (error) => {
      console.error("Frontend process error:", error);
      cleanup();
    });

    // Handle process exit
    backend.on("exit", (code) => {
      if (code !== 0) {
        console.error(`Backend process exited with code ${code}`);
        cleanup();
      }
    });

    frontend.on("exit", (code) => {
      if (code !== 0) {
        console.error(`Frontend process exited with code ${code}`);
        cleanup();
      }
    });
  } catch (error) {
    console.error("Failed to start development environment:", error);
    process.exit(1);
  }
}

// Run the development script
startDev();
