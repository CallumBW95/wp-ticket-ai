import { MCPToolCall, MCPToolResult } from "../types";

const MCP_SERVER_URL =
  "https://mcp-server-wporg-trac-staging.a8cai.workers.dev";

let availableTools: any[] = [];

// Simplified MCP client for WordPress MCP server
export async function initializeMCP(): Promise<void> {
  try {
    console.log("Attempting to connect to WordPress MCP server...");

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
  if (!availableTools.length) {
    return [];
  }

  return availableTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema || {
      type: "object",
      properties: {},
      required: [],
    },
  }));
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
    return {
      content: [
        {
          type: "text",
          text: `Error calling ${toolCall.name}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
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
