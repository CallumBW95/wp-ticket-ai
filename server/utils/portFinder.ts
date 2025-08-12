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

      return port;
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error(
          `No available ports found in range ${startPort}-${
            startPort + maxAttempts - 1
          }`
        );
      }
      // Continue to next port
    }
  }

  throw new Error(
    `No available ports found in range ${startPort}-${
      startPort + maxAttempts - 1
    }`
  );
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
      return port;
    }
  }
  return 3001; // Default fallback
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
    }
    return port;
  } catch (error) {
    console.error("Failed to find available port:", error);
    throw error;
  }
}
