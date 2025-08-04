import { initializeGemini } from "./gemini";
import { initializeMCP, disconnectMCP } from "./mcp";

export async function initializeServices(): Promise<void> {
  try {
    // Initialize Gemini
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("VITE_GEMINI_API_KEY environment variable is required");
    }
    await initializeGemini(geminiApiKey);

    // Initialize MCP connection
    await initializeMCP();

    console.log("All services initialized successfully");
  } catch (error) {
    console.error("Failed to initialize services:", error);
    throw error;
  }
}
