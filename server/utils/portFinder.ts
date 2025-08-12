import { createServer } from "net";

/**
 * Find an available port starting from the given port
 * @param startPort - The port to start searching from
 * @param maxAttempts - Maximum number of ports to try
 * @returns Promise<number> - The first available port found
 */
export async function findAvailablePort(
  startPort: number,
  maxAttempts: number = 10
): Promise<number> {
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
      await new Promise<void>((resolve, reject) => {
        const server = createServer();

        server.listen(port, () => {
          server.close();
          resolve();
        });

        server.on("error", (err: any) => {
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
            `   3. Setting a custom port via PORT environment variable`
        );
      }
      console.log(`⚠️  Port ${port} is in use, trying next port...`);
    }
  }

  throw new Error("Unexpected error in port finding logic");
}

/**
 * Get the default port from environment or use fallback
 * @returns number - The default port to use
 */
export function getDefaultPort(): number {
  const envPort = process.env.PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      console.log(`🔧 Using port from PORT environment variable: ${port}`);
      return port;
    } else {
      console.warn(
        `⚠️  Invalid PORT environment variable: "${envPort}". Using default port 3001.`
      );
    }
  }

  const defaultPort = 3001;
  console.log(`🔧 Using default port: ${defaultPort}`);
  return defaultPort;
}

/**
 * Find an available port with fallback logic
 * @param preferredPort - Preferred port to try first
 * @returns Promise<number> - Available port
 */
export async function findPort(preferredPort?: number): Promise<number> {
  const startPort = preferredPort || getDefaultPort();

  try {
    const port = await findAvailablePort(startPort);
    if (port !== startPort) {
      console.log(
        `⚠️  Port ${startPort} is in use, using port ${port} instead`
      );
    } else {
      console.log(`✅ Using preferred port: ${port}`);
    }
    return port;
  } catch (error) {
    console.error("❌ CRITICAL ERROR: Failed to find available port!");
    console.error("");
    console.error(
      "🔍 Error details:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("");
    console.error(
      "🚫 Server startup failed. Please resolve the port conflict and try again."
    );
    throw error;
  }
}
