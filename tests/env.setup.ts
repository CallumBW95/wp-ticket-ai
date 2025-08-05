import { config } from "dotenv";
import { join } from "path";

// Load environment variables for tests
const envPath = join(process.cwd(), ".env");
config({ path: envPath });

// Set test environment
process.env.NODE_ENV = "test";

// Override environment variables for testing
process.env.PORT = "3002"; // Use different port for tests
process.env.ENABLE_SCRAPING = "false";
process.env.LOG_LEVEL = "error";

// Suppress console output during tests unless explicitly needed
if (process.env.SHOW_CONSOLE !== "true") {
  // Mock console methods to reduce noise in tests
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;
  const originalConsoleDebug = console.debug;

  // Override console methods
  console.log = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();

  // Keep error logging for debugging
  console.error = console.error;
}
