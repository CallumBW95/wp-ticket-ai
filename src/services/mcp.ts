import { MCPToolCall, MCPToolResult } from "../types";

const MCP_SERVER_URL = "http://localhost:3001/api/mcp";

let availableTools: any[] = [];

// Simplified MCP client for WordPress MCP server
export async function initializeMCP(): Promise<void> {
  try {
    console.log("🔄 Attempting to connect to WordPress MCP server...");
    console.log("🌐 MCP Server URL:", MCP_SERVER_URL);

    // First, try to get server capabilities via initialize request
    const initResult = await makeJsonRpcRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: "WP Aggregator AI",
        version: "1.0.0",
      },
    });

    if (initResult) {
      console.log("MCP server initialized:", initResult);

      // Get available tools
      const toolsResult = await makeJsonRpcRequest("tools/list");
      if (toolsResult?.tools) {
        availableTools = toolsResult.tools;
        console.log(
          `Found ${availableTools.length} MCP tools:`,
          availableTools.map((t) => t.name)
        );
      }
    }
  } catch (error) {
    console.error("Failed to connect to MCP server:", error);
    // For debugging, let's try to test the raw endpoint
    await testMCPEndpoint();
  }
}

async function testMCPEndpoint(): Promise<void> {
  try {
    console.log("Testing MCP server endpoint...");

    // Test if the endpoint responds to a basic request
    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "test-1",
        method: "tools/list",
        params: {},
      }),
    });

    console.log("MCP endpoint response status:", response.status);
    console.log(
      "MCP endpoint response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (response.ok) {
      const data = await response.json();
      console.log("MCP endpoint response data:", data);

      if (data.result?.tools) {
        availableTools = data.result.tools;
        console.log(
          `Found ${availableTools.length} tools via direct endpoint test`
        );
      }
    } else {
      const text = await response.text();
      console.log("MCP endpoint error response:", text);
    }
  } catch (error) {
    console.error("Failed to test MCP endpoint:", error);
  }
}

async function makeJsonRpcRequest(method: string, params?: any): Promise<any> {
  try {
    const request = {
      jsonrpc: "2.0",
      id: `req-${Date.now()}`,
      method,
      params: params || {},
    };

    console.log("Sending MCP request:", request);

    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("MCP response:", result);

    if (result.error) {
      throw new Error(
        `MCP Error: ${result.error.message || result.error.code}`
      );
    }

    return result.result;
  } catch (error) {
    console.error(`MCP request failed (${method}):`, error);
    throw error;
  }
}

export async function getMCPTools(): Promise<any[]> {
  console.log(
    `🔧 getMCPTools called, availableTools.length: ${availableTools.length}`
  );
  if (!availableTools.length) {
    console.log(
      "⚠️ No MCP tools available - MCP may not be initialized properly"
    );
    return [];
  }

  const formattedTools = availableTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema || {
      type: "object",
      properties: {},
      required: [],
    },
  }));

  console.log(
    "🔧 Formatted MCP tools for Gemini:",
    JSON.stringify(formattedTools, null, 2)
  );
  return formattedTools;
}

export async function callMCPTool(
  toolCall: MCPToolCall
): Promise<MCPToolResult> {
  try {
    console.log(`Calling MCP tool: ${toolCall.name}`, toolCall.arguments);

    const result = await makeJsonRpcRequest("tools/call", {
      name: toolCall.name,
      arguments: toolCall.arguments,
    });

    console.log("MCP tool result:", result);

    // Handle MCP content format
    if (result?.content) {
      return {
        content: Array.isArray(result.content)
          ? result.content
          : [result.content],
        isError: false,
      };
    }

    // Handle direct result
    if (result) {
      return {
        content: [
          {
            type: "text",
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    }

    // Fallback for empty result
    return {
      content: [
        {
          type: "text",
          text: "Tool executed successfully but returned no content.",
        },
      ],
      isError: false,
    };
  } catch (error) {
    console.error("Error calling MCP tool:", error);

    // Enhanced MCP error handling
    let mcpErrorMessage = `MCP tool "${toolCall.name}" failed`;
    let mcpErrorDetails = "";
    let troubleshooting = "";

    if (error instanceof Error) {
      if (
        error.message.includes("fetch") ||
        error.message.includes("network")
      ) {
        mcpErrorMessage = "MCP server connection failed";
        mcpErrorDetails = "Unable to connect to the WordPress Trac MCP server";
        troubleshooting =
          "Check if the MCP server URL is correct and accessible";
      } else if (error.message.includes("timeout")) {
        mcpErrorMessage = "MCP request timeout";
        mcpErrorDetails = "The MCP server took too long to respond";
        troubleshooting =
          "Try again with a smaller request or check server status";
      } else if (error.message.includes("404")) {
        mcpErrorMessage = "MCP endpoint not found";
        mcpErrorDetails = "The requested MCP tool or endpoint doesn't exist";
        troubleshooting = "Verify the tool name and MCP server configuration";
      } else if (error.message.includes("500")) {
        mcpErrorMessage = "MCP server error";
        mcpErrorDetails =
          "The WordPress Trac MCP server encountered an internal error";
        troubleshooting =
          "The server may be temporarily unavailable. Try again later";
      } else if (
        error.message.includes("unauthorized") ||
        error.message.includes("401")
      ) {
        mcpErrorMessage = "MCP authentication failed";
        mcpErrorDetails = "Unable to authenticate with the MCP server";
        troubleshooting = "Check MCP server credentials and permissions";
      } else if (
        error.message.includes("JSON") ||
        error.message.includes("parse")
      ) {
        mcpErrorMessage = "MCP response parsing error";
        mcpErrorDetails = "Received invalid data from MCP server";
        troubleshooting = "The MCP server may be returning malformed data";
      } else {
        mcpErrorDetails = error.message;
        troubleshooting = "Check the MCP server logs for more details";
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `🔌 ${mcpErrorMessage}${
            mcpErrorDetails ? `\n📋 ${mcpErrorDetails}` : ""
          }${troubleshooting ? `\n🔧 ${troubleshooting}` : ""}\n\nTool: ${
            toolCall.name
          }\nArguments: ${JSON.stringify(
            toolCall.arguments,
            null,
            2
          )}\nMCP Server: ${MCP_SERVER_URL}`,
        },
      ],
      isError: true,
    };
  }
}

// Cleanup function
export function disconnectMCP(): void {
  availableTools = [];
  console.log("MCP connection cleaned up");
}
