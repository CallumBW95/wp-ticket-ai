import {
  GoogleGenerativeAI,
  GenerativeModel,
  ChatSession,
} from "@google/generative-ai";
import { MCPToolCall, MCPToolResult } from "../types";
import { callMCPTool, getMCPTools } from "./mcp";
import * as TicketService from "./tickets";

let genAI: GoogleGenerativeAI;
let model: GenerativeModel;
let chatSession: ChatSession;

function getSystemPrompt(): string {
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeString = currentDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `You are a WordPress AI assistant with access to real-time WordPress.org data through MCP (Model Context Protocol) tools. 

CURRENT DATE AND TIME: ${dateString} at ${timeString}

IMPORTANT CONTEXT:
- Today's date is ${currentDate.toISOString().split("T")[0]} (YYYY-MM-DD format)
- Current year is ${currentDate.getFullYear()}
- You have access to current WordPress.org tickets, documentation, and development information through MCP tools
- When users ask about "recent" or "current" information, use the MCP tools to get up-to-date data
- Always provide accurate, current information about WordPress development

CAPABILITIES:
- Search WordPress.org tickets and issues
- Access current WordPress documentation
- Provide information about latest WordPress versions and features
- Help with WordPress development questions using current best practices
- Use MCP tools when you need real-time WordPress.org data

INSTRUCTIONS:
- Always be aware of the current date when answering questions
- Use MCP tools to verify and get current information when discussing WordPress tickets, versions, or recent developments
- Use the ticket search tools to find specific WordPress Trac tickets and provide detailed information
- When users ask about tickets, bugs, or issues, search the local ticket database first for the most comprehensive information
- Provide helpful, accurate, and up-to-date WordPress assistance with real ticket data`;
}

export async function initializeGemini(apiKey: string): Promise<void> {
  genAI = new GoogleGenerativeAI(apiKey);

  // Get available MCP tools for function calling
  const mcpTools = await getMCPTools();

  // Add custom ticket search tools
  const ticketTools = getTicketSearchTools();

  model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: [
      ...(mcpTools.length > 0 ? [{ functionDeclarations: mcpTools }] : []),
      { functionDeclarations: ticketTools },
    ],
  });

  chatSession = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: getSystemPrompt() }],
      },
      {
        role: "model",
        parts: [
          {
            text: "I understand. I'm your WordPress AI assistant, and I have access to current WordPress.org data through MCP tools. I know today's date and will provide up-to-date information about WordPress development, tickets, documentation, and best practices. How can I help you with WordPress today?",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 64,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  });
}

export async function sendMessage(message: string): Promise<string> {
  if (!chatSession) {
    throw new Error("Gemini not initialized");
  }

  try {
    const result = await chatSession.sendMessage(message);
    const response = await result.response;

    // Handle function calls if present
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const toolResults: MCPToolResult[] = [];

      for (const functionCall of functionCalls) {
        try {
          let toolResult: MCPToolResult;

          // Check if it's a ticket search tool
          if (isTicketSearchTool(functionCall.name)) {
            toolResult = await callTicketTool(
              functionCall.name,
              functionCall.args || {}
            );
          } else {
            // Handle MCP tools
            const toolCall: MCPToolCall = {
              name: functionCall.name,
              arguments: functionCall.args || {},
            };
            toolResult = await callMCPTool(toolCall);
          }

          toolResults.push(toolResult);
        } catch (error) {
          toolResults.push({
            content: [
              {
                type: "text",
                text: `Error calling tool ${functionCall.name}: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              },
            ],
            isError: true,
          });
        }
      }

      // Send tool results back to get final response
      const toolResponse = await chatSession.sendMessage(
        toolResults.map((result) => ({
          functionResponse: {
            name: functionCalls[toolResults.indexOf(result)].name,
            response: result,
          },
        }))
      );

      return toolResponse.response.text();
    }

    return response.text();
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    throw new Error("Failed to get response from Gemini");
  }
}

export function resetChat(): void {
  if (model) {
    chatSession = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: getSystemPrompt() }],
        },
        {
          role: "model",
          parts: [
            {
              text: "I understand. I'm your WordPress AI assistant, and I have access to current WordPress.org data through MCP tools. I know today's date and will provide up-to-date information about WordPress development, tickets, documentation, and best practices. How can I help you with WordPress today?",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 64,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });
  }
}

// Ticket search tools definition
function getTicketSearchTools(): any[] {
  return [
    {
      name: "search_wordpress_tickets",
      description:
        "Search WordPress Trac tickets by text query. Use this to find tickets related to specific topics, bugs, or features.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant tickets",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 10)",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_ticket_details",
      description:
        "Get detailed information about a specific WordPress Trac ticket by ID",
      parameters: {
        type: "object",
        properties: {
          ticketId: {
            type: "number",
            description: "The WordPress Trac ticket ID",
          },
        },
        required: ["ticketId"],
      },
    },
    {
      name: "get_recent_tickets",
      description: "Get recently updated WordPress Trac tickets",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "Number of days to look back (default: 7)",
            default: 7,
          },
        },
      },
    },
    {
      name: "get_tickets_by_component",
      description: "Get WordPress Trac tickets for a specific component",
      parameters: {
        type: "object",
        properties: {
          component: {
            type: "string",
            description:
              "Component name (e.g. 'Editor', 'Media', 'Themes', 'Plugins')",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 20)",
            default: 20,
          },
        },
        required: ["component"],
      },
    },
    {
      name: "get_tickets_by_status",
      description: "Get WordPress Trac tickets by status",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description:
              "Ticket status (e.g. 'new', 'assigned', 'accepted', 'reviewing', 'closed')",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 20)",
            default: 20,
          },
        },
        required: ["status"],
      },
    },
  ];
}

function isTicketSearchTool(toolName: string): boolean {
  const ticketTools = [
    "search_wordpress_tickets",
    "get_ticket_details",
    "get_recent_tickets",
    "get_tickets_by_component",
    "get_tickets_by_status",
  ];
  return ticketTools.includes(toolName);
}

async function callTicketTool(
  toolName: string,
  args: any
): Promise<MCPToolResult> {
  try {
    let result: any;

    switch (toolName) {
      case "search_wordpress_tickets":
        result = await TicketService.searchTickets(args.query, args.limit);
        break;
      case "get_ticket_details":
        result = await TicketService.getTicketDetails(args.ticketId);
        break;
      case "get_recent_tickets":
        result = await TicketService.getRecentTickets(args.days);
        break;
      case "get_tickets_by_component":
        result = await TicketService.getTicketsByComponent(
          args.component,
          args.limit
        );
        break;
      case "get_tickets_by_status":
        result = await TicketService.getTicketsByStatus(
          args.status,
          args.limit
        );
        break;
      default:
        throw new Error(`Unknown ticket tool: ${toolName}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error calling ticket tool ${toolName}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      isError: true,
    };
  }
}

// Add a cleanup function to handle connection cleanup
export function cleanupConnections(): void {
  // This could include cleanup for any resources if needed
  console.log("Gemini connections cleaned up");
}
