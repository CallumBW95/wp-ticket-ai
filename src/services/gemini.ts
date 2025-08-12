import {
  GoogleGenerativeAI,
  GenerativeModel,
  ChatSession,
} from "@google/generative-ai";
import { MCPToolCall, MCPToolResult } from "../types";
import { callMCPTool, getMCPTools } from "./mcp";
import * as TicketService from "./tickets";
import { getGitHubTools, callGitHubTool } from "./github";

let genAI: GoogleGenerativeAI;
let model: GenerativeModel;
let chatSession: ChatSession;

// Request queue and throttling
interface QueuedRequest {
  id: string;
  message: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  retryCount: number;
  timestamp: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minDelayBetweenRequests = 1000; // 1 second minimum between requests
  private readonly maxDelayBetweenRequests = 5000; // 5 seconds maximum
  private readonly maxRetries = 3;
  private readonly baseRetryDelay = 2000; // 2 seconds

  async addRequest(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        message,
        resolve,
        reject,
        retryCount: 0,
        timestamp: Date.now(),
      };

      this.queue.push(request);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      
      // Ensure minimum delay between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelayBetweenRequests) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minDelayBetweenRequests - timeSinceLastRequest)
        );
      }

      try {
        console.log(`🔄 Processing request ${request.id} (${this.queue.length} remaining in queue)`);
        this.lastRequestTime = Date.now();
        
        const result = await this.sendMessageWithRetry(request.message, request.retryCount);
        request.resolve(result);
      } catch (error) {
        if (request.retryCount < this.maxRetries && this.shouldRetry(error)) {
          // Exponential backoff
          const delay = this.baseRetryDelay * Math.pow(2, request.retryCount);
          console.log(`🔄 Retrying request ${request.id} in ${delay}ms (attempt ${request.retryCount + 1}/${this.maxRetries})`);
          
          request.retryCount++;
          request.timestamp = Date.now();
          
          // Add back to queue with delay
          setTimeout(() => {
            this.queue.unshift(request);
            this.processQueue();
          }, delay);
        } else {
          request.reject(error as Error);
        }
      }
    }

    this.processing = false;
  }

  private shouldRetry(error: any): boolean {
    if (!(error instanceof Error)) return false;
    
    const message = error.message.toLowerCase();
    return (
      message.includes("rate") ||
      message.includes("quota") ||
      message.includes("429") ||
      message.includes("503") ||
      message.includes("overloaded") ||
      message.includes("timeout") ||
      message.includes("network")
    );
  }

  private async sendMessageWithRetry(message: string, retryCount: number): Promise<string> {
    if (!chatSession) {
      throw new Error("Gemini not initialized");
    }

    try {
      console.log("📤 Sending message to Gemini:", message);
      const result = await chatSession.sendMessage(message);
      const response = await result.response;
      console.log("📥 Got response from Gemini");
      console.log("📄 Raw response text:", response.text());

      // Handle function calls if present
      const functionCalls = response.functionCalls();
      console.log(
        "🔍 Function calls detected:",
        functionCalls ? functionCalls.length : 0
      );
      console.log("🔍 Raw function calls object:", functionCalls);

      if (functionCalls && functionCalls.length > 0) {
        console.log(
          `🛠️ Calling ${functionCalls.length} functions:`,
          functionCalls.map((f) => f.name)
        );
        console.log(
          "📋 Function call details:",
          functionCalls.map((f) => ({ name: f.name, args: f.args }))
        );
        const toolResults: MCPToolResult[] = [];

        // Add delay between tool calls to prevent rate limiting
        for (let i = 0; i < functionCalls.length; i++) {
          const functionCall = functionCalls[i];
          
          // Add delay between tool calls (except for the first one)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between tool calls
          }
          
          try {
            let toolResult: MCPToolResult;

            // Check if it's a ticket search tool
            if (isTicketSearchTool(functionCall.name)) {
              console.log(`🎫 Calling ticket search tool: ${functionCall.name}`);
              toolResult = await callTicketTool(
                functionCall.name,
                functionCall.args || {}
              );
            } else if (isGitHubTool(functionCall.name)) {
              // Handle GitHub tools
              console.log(`🐙 Calling GitHub tool: ${functionCall.name}`);
              toolResult = await callGitHubTool(
                functionCall.name,
                functionCall.args || {}
              );
            } else {
              // Handle MCP tools
              console.log(`🔗 Calling MCP tool: ${functionCall.name}`);
              const toolCall: MCPToolCall = {
                name: functionCall.name,
                arguments: functionCall.args || {},
              };
              toolResult = await callMCPTool(toolCall);
            }

            console.log(`✅ Tool ${functionCall.name} result:`, toolResult);

            toolResults.push(toolResult);
          } catch (error) {
            console.error(`🚨 Tool ${functionCall.name} failed:`, error);

            let toolErrorMessage = `Tool "${functionCall.name}" failed`;
            let toolErrorDetails = "";

            if (error instanceof Error) {
              if (error.message.includes("timeout")) {
                toolErrorDetails =
                  "The tool took too long to respond. This usually happens with large data requests";
              } else if (
                error.message.includes("network") ||
                error.message.includes("fetch")
              ) {
                toolErrorDetails =
                  "Network connection error while calling external service";
              } else if (
                error.message.includes("404") ||
                error.message.includes("not found")
              ) {
                toolErrorDetails = "The requested resource was not found";
              } else if (
                error.message.includes("401") ||
                error.message.includes("unauthorized")
              ) {
                toolErrorDetails =
                  "Authentication failed - please check API credentials";
              } else if (
                error.message.includes("403") ||
                error.message.includes("forbidden")
              ) {
                toolErrorDetails = "Access denied - insufficient permissions";
              } else if (
                error.message.includes("500") ||
                error.message.includes("internal server")
              ) {
                toolErrorDetails = "External service is experiencing issues";
              } else if (
                error.message.includes("parse") ||
                error.message.includes("JSON")
              ) {
                toolErrorDetails =
                  "Invalid response format from external service";
              } else {
                toolErrorDetails = error.message;
              }
            }

            toolResults.push({
              content: [
                {
                  type: "text",
                  text: `❌ ${toolErrorMessage}${
                    toolErrorDetails ? `\n💡 ${toolErrorDetails}` : ""
                  }\n\nTool: ${functionCall.name}\nArguments: ${JSON.stringify(
                    functionCall.args,
                    null,
                    2
                  )}`,
                },
              ],
              isError: true,
            });
          }
        }

        // Add delay before sending tool results back
        await new Promise(resolve => setTimeout(resolve, 300));

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
      } else {
        console.log("ℹ️ No function calls made, returning direct response");
      }

      return response.text();
    } catch (error) {
      console.error("Error sending message to Gemini:", error);

      // Enhanced error handling with specific error details
      let errorMessage = "Failed to get response from Gemini";
      let errorDetails = "";

      if (error instanceof Error) {
        // Handle specific Gemini API errors
        if (error.message.includes("API_KEY")) {
          errorMessage = "Invalid Google Gemini API key";
          errorDetails =
            "Please check your GOOGLE_GEMINI_API_KEY environment variable";
        } else if (error.message.includes("quota")) {
          errorMessage = "Gemini API quota exceeded";
          errorDetails =
            "You've reached your API usage limit. Please try again later or check your Google Cloud quota";
        } else if (error.message.includes("rate")) {
          errorMessage = "Too many requests to Gemini API";
          errorDetails = "Please wait a moment before sending another message";
        } else if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          errorMessage = "Network connection error";
          errorDetails =
            "Unable to connect to Google Gemini API. Please check your internet connection";
        } else if (
          error.message.includes("blocked") ||
          error.message.includes("safety")
        ) {
          errorMessage = "Message blocked by safety filters";
          errorDetails =
            "Your message was flagged by Google's safety systems. Please rephrase your question";
        } else if (error.message.includes("model")) {
          errorMessage = "Gemini model error";
          errorDetails = `Model issue: ${error.message}`;
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timeout";
          errorDetails =
            "The AI model took too long to respond. Please try with a shorter message";
        } else if (
          error.message.includes("503") ||
          error.message.includes("overloaded")
        ) {
          errorMessage = "Gemini model is currently overloaded";
          errorDetails =
            "Google's servers are experiencing high demand. Please wait a few minutes and try again";
        } else {
          errorMessage = "Gemini API error";
          errorDetails = error.message;
        }
      }

      const enhancedError = new Error(
        `${errorMessage}${errorDetails ? `: ${errorDetails}` : ""}`
      );
      enhancedError.name = "GeminiError";
      throw enhancedError;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}

const requestQueue = new RequestQueue();

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

WORDPRESS CODE STANDARDS & FORMATTING:
When providing code solutions, always follow WordPress standards:

PHP CODE:
- Use WordPress Coding Standards (WPCS)
- Follow PSR-4 autoloading for classes
- Use proper WordPress hooks, filters, and actions
- Include proper DocBlocks with @since, @param, @return
- Use WordPress sanitization/validation functions
- Follow WordPress file structure conventions

UNIT TESTS:
- Use PHPUnit framework (WordPress uses PHPUnit 9+)
- Test files should be in tests/ directory
- Test class names: Tests_ComponentName or WP_Test_ComponentName
- Use WordPress test factories for creating test data
- Include setUp() and tearDown() methods
- Test method names: test_specific_functionality_description()
- Use WordPress-specific assertions and helpers

Example PHPUnit test structure:
\`\`\`php
<?php
/**
 * Test file description
 *
 * @package WordPress
 * @subpackage Tests
 */

class Tests_Component_Functionality extends WP_UnitTestCase {
    
    public function setUp(): void {
        parent::setUp();
        // Setup test data
    }
    
    public function tearDown(): void {
        // Cleanup
        parent::tearDown();
    }
    
    /**
     * Test specific functionality.
     *
     * @ticket XXXXX
     */
    public function test_specific_functionality() {
        // Test implementation
        \$this->assertSame( \$expected, \$actual );
    }
}
\`\`\`

JAVASCRIPT/BLOCK DEVELOPMENT:
- Use ES6+ modern JavaScript
- Follow WordPress JavaScript coding standards
- Use @wordpress packages for Block Editor development
- Include proper JSDoc comments
- Use WordPress testing framework (@wordpress/scripts)

CSS:
- Follow WordPress CSS coding standards
- Use proper BEM methodology when appropriate
- Include RTL support considerations
- Use WordPress admin color schemes

HOOKS & FILTERS:
- Always provide hook/filter examples with proper priorities
- Include security considerations (nonces, capability checks)
- Show proper escaping and sanitization

COMPONENT-SPECIFIC GUIDANCE:
- Core functions: Include proper WordPress globals, hooks
- Themes: Follow WordPress theme standards, template hierarchy
- Plugins: Include proper plugin headers, activation/deactivation hooks
- REST API: Use WordPress REST API standards and authentication
- Blocks: Use @wordpress/scripts and proper block.json format
- Database: Use \$wpdb properly, include schema considerations

TICKET ANALYSIS & NEXT STEPS:
When analyzing WordPress Trac tickets, provide comprehensive analysis:

TICKET INFORMATION:
- Current status and priority
- Component affected
- WordPress version impact
- Reporter and any assignees
- Related tickets or dependencies

NEXT STEPS ANALYSIS:
- Determine what actions are needed (investigation, patch, tests, documentation)
- Identify if it's ready for development or needs more information
- Suggest specific implementation approach
- Identify testing requirements
- Consider backward compatibility implications

CODE SOLUTIONS:
When tickets require code solutions, provide:

For BUG FIXES:
- Minimal patch that addresses the root cause
- Include proper error handling and validation
- Add inline comments explaining the fix
- Reference the ticket number in code comments

For NEW FEATURES:
- Complete implementation with all necessary files
- Include proper capability checks and security measures
- Add comprehensive PHPUnit tests
- Include user documentation if needed

For ENHANCEMENTS:
- Backward-compatible implementation
- Deprecation notices if replacing existing functionality
- Migration path for existing implementations

CODE REVIEW STANDARDS:
- Follow WordPress Core Contributor Handbook
- Include @since tags with next WordPress version
- Add proper @ticket references
- Use WordPress sanitization and validation functions
- Include accessibility considerations
- Consider performance implications

PATCH FORMAT:
\`\`\`php
<?php
/**
 * Description of the change.
 *
 * @since X.X.X
 * @ticket XXXXX
 */
\`\`\`

UNIT TEST FORMAT:
\`\`\`php
/**
 * @ticket XXXXX
 * @covers function_name
 */
public function test_specific_functionality_description() {
    // Arrange
    \$input = 'test data';
    
    // Act  
    \$result = function_name( \$input );
    
    // Assert
    \$this->assertSame( \$expected, \$result );
}
\`\`\`

INSTRUCTIONS:
- Always be aware of the current date when answering questions
- IMMEDIATELY use available tools when users ask about specific tickets, bugs, or WordPress development topics
- When a user mentions a ticket number (like "ticket 63778" or "63778"), AUTOMATICALLY call getTicket to get full ticket details
- When analyzing ticket discussions, patches, or development history, ALWAYS use getTicket for complete context
- When asked about changesets or commits, AUTOMATICALLY call getChangeset with the revision number
- When asked about recent activity, AUTOMATICALLY call getTimeline
- When searching for tickets by topic, use searchTickets with relevant keywords
- When you need system information about WordPress Trac, use getTracInfo
- When asked about WordPress code, functions, or implementation details, AUTOMATICALLY use GitHub tools:
  * search_wordpress_code - Find functions, classes, or code patterns
  * get_wordpress_file - Get complete file contents
  * get_wordpress_directory - Explore codebase structure
  * get_wordpress_commit - Analyze specific commits
  * search_wordpress_commits - Find related code changes
- NEVER say you need explicit function calls - you have access to tools and should use them automatically
- Use MCP tools (getTicket, searchTickets, etc.), GitHub tools (search_wordpress_code, get_wordpress_file, etc.), and local database tools for comprehensive information
- When tickets are not found in the local database, they will be automatically fetched from WordPress Trac and saved locally for future use
- When providing code solutions, examine the current WordPress codebase to ensure accuracy and compatibility
- Always check existing implementations before suggesting new code
- COMMENT ANALYSIS: When discussing tickets, always analyze comment discussions to understand:
  * Patch evolution and feedback
  * Testing results and findings
  * Developer concerns and objections
  * Implementation decisions and rationale
  * Review feedback and code quality issues
  * Community consensus and disagreements
- When providing code solutions, ALWAYS format them according to WordPress standards for the specific component
- Include relevant @ticket references when discussing fixes or enhancements
- For each ticket, provide: current status, detailed next steps, and code solutions when applicable
- Follow WordPress Core Contributor Handbook guidelines for all code suggestions
- Consider the full development lifecycle: patch → tests → documentation → review
- Provide helpful, accurate, and up-to-date WordPress assistance with real ticket data and properly formatted code`;
}

export async function initializeGemini(apiKey: string): Promise<void> {
  genAI = new GoogleGenerativeAI(apiKey);

  // Get available MCP tools for function calling
  const mcpTools = await getMCPTools();

  // Add custom ticket search tools
  const ticketTools = [
    {
      name: "searchTickets",
      description:
        "Search for WordPress Trac tickets by keyword or filter expression. Returns ticket summaries with basic info.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (keywords, ticket numbers, etc.)",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 20)",
            default: 20,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "getTicket",
      description:
        "Get detailed information about a specific WordPress Trac ticket. Use this when you need to analyze ticket details, status, or basic information.",
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
      name: "getChangeset",
      description:
        "Get information about a specific changeset (commit) in WordPress Trac. Use this when analyzing code changes or development history.",
      parameters: {
        type: "object",
        properties: {
          changesetId: {
            type: "string",
            description: "The changeset ID (commit hash)",
          },
        },
        required: ["changesetId"],
      },
    },
    {
      name: "getTimeline",
      description:
        "Get timeline information from WordPress Trac. Use this when you need to understand recent activity or changes.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "Number of days to look back (default: 7)",
            default: 7,
          },
        },
        required: [],
      },
    },
    {
      name: "getTracInfo",
      description:
        "Get general information about WordPress Trac. Use this for system information or status checks.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  ];

  // Add GitHub tools for WordPress codebase access
  const githubTools = getGitHubTools();

  console.log(
    `Initializing Gemini with ${mcpTools.length} MCP tools, ${ticketTools.length} ticket tools, and ${githubTools.length} GitHub tools`
  );
  console.log(
    "🔧 MCP Tools:",
    mcpTools.map((t: any) => ({ name: t.name, description: t.description }))
  );
  console.log(
    "🔧 Ticket Tools:",
    ticketTools.map((t: any) => ({ name: t.name, description: t.description }))
  );
  console.log(
    "🔧 GitHub Tools:",
    githubTools.map((t: any) => ({ name: t.name, description: t.description }))
  );

  model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: [
      ...(mcpTools.length > 0 ? [{ functionDeclarations: mcpTools }] : []),
      { functionDeclarations: ticketTools },
      { functionDeclarations: githubTools },
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
            text: "I understand. I'm your WordPress AI assistant with access to current WordPress.org data through MCP tools, the complete WordPress codebase via GitHub, and comprehensive knowledge of WordPress coding standards. I will automatically use my available tools (getTicket, searchTickets, search_wordpress_code, get_wordpress_file, etc.) whenever you ask about specific tickets, bugs, or WordPress development topics. I can examine the current WordPress codebase, find implementations, analyze commits, and provide detailed ticket analysis including current status, next steps, and properly formatted code solutions. I follow WordPress Core Contributor Handbook guidelines and can help with patches, unit tests, hooks, filters, blocks, and more. How can I help you with WordPress development today?",
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

export async function sendMessage(
  message: string,
  onThinkingStep?: (step: string) => void
): Promise<string> {
  try {
    // Add thinking step for message analysis
    const thinkingStep =
      "🔍 Analyzing user request and determining required tools...";
    if (onThinkingStep) onThinkingStep(thinkingStep);

    // Use the request queue to handle rate limiting and throttling
    const result = await requestQueue.addRequest(message);

    // Add thinking step for response generation
    const responseStep = "🤖 Response generated successfully";
    if (onThinkingStep) onThinkingStep(responseStep);

    return result;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    throw error;
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
              text: "I understand. I'm your WordPress AI assistant with access to current WordPress.org data through MCP tools, the complete WordPress codebase via GitHub, and comprehensive knowledge of WordPress coding standards. I will automatically use my available tools (getTicket, searchTickets, search_wordpress_code, get_wordpress_file, etc.) whenever you ask about specific tickets, bugs, or WordPress development topics. I can examine the current WordPress codebase, find implementations, analyze commits, and provide detailed ticket analysis including current status, next steps, and properly formatted code solutions. I follow WordPress Core Contributor Handbook guidelines and can help with patches, unit tests, hooks, filters, blocks, and more. How can I help you with WordPress development today?",
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

// Queue status functions for monitoring
export function getQueueStatus() {
  return {
    queueLength: requestQueue.getQueueLength(),
    isProcessing: requestQueue.isProcessing(),
  };
}

export function clearQueue() {
  // This would need to be implemented in the RequestQueue class if needed
  console.log("🔄 Queue clear requested");
}

// Ticket search tools definition
function isTicketSearchTool(toolName: string): boolean {
  const ticketTools = [
    "searchTickets",
    "getTicket",
    "getChangeset",
    "getTimeline",
    "getTracInfo",
  ];

  return ticketTools.includes(toolName);
}

function isGitHubTool(toolName: string): boolean {
  const githubTools = [
    "search_wordpress_code",
    "get_wordpress_file",
    "get_wordpress_directory",
    "get_wordpress_commit",
    "search_wordpress_commits",
  ];

  return githubTools.includes(toolName);
}

// Add thinking steps for tool usage
function addToolThinkingStep(toolName: string, args: any): string {
  const step = `🔧 Using ${toolName} tool`;
  if (args && Object.keys(args).length > 0) {
    const argStr = Object.entries(args)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    return `${step} with arguments: ${argStr}`;
  }
  return step;
}

// Helper function to call MCP server directly
async function callMCPServer(toolName: string, args: any): Promise<any> {
  try {
    const response = await fetch("/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `mcp-${Date.now()}`,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `MCP server error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`MCP tool error: ${data.error.message || data.error}`);
    }

    // Extract the content from the MCP response
    if (data.result && data.result.content && data.result.content.length > 0) {
      const content = data.result.content[0];
      if (content.type === "text") {
        try {
          return JSON.parse(content.text);
        } catch {
          return content.text;
        }
      }
      return content;
    }

    return data.result || data;
  } catch (error) {
    console.error(`Error calling MCP server for ${toolName}:`, error);
    throw error;
  }
}

// Update the tool calling functions to include thinking steps
async function callTicketTool(
  toolName: string,
  args: any
): Promise<MCPToolResult> {
  try {
    const thinkingStep = addToolThinkingStep(toolName, args);
    console.log(thinkingStep);

    let result: any;

    switch (toolName) {
      case "searchTickets":
        result = await TicketService.searchTickets(args.query, args.limit);
        break;
      case "getTicket":
        result = await TicketService.getTicketDetails(args.ticketId);
        break;
      case "getChangeset":
        // Call MCP server directly for changeset info
        result = await callMCPServer("getChangeset", args);
        break;
      case "getTimeline":
        // Call MCP server directly for timeline info
        result = await callMCPServer("getTimeline", args);
        break;
      case "getTracInfo":
        // Call MCP server directly for trac info
        result = await callMCPServer("getTracInfo", args);
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

async function callGitHubTool(
  toolName: string,
  args: any
): Promise<MCPToolResult> {
  try {
    const thinkingStep = addToolThinkingStep(toolName, args);
    console.log(thinkingStep);

    let result: any;

    switch (toolName) {
      case "search_wordpress_code":
        result = await getGitHubTools().find(args.query);
        break;
      case "get_wordpress_file":
        result = await getGitHubTools().getFileContent(args.filePath);
        break;
      case "get_wordpress_directory":
        result = await getGitHubTools().getDirectoryContent(args.path);
        break;
      case "get_wordpress_commit":
        result = await getGitHubTools().getCommitDetails(args.commitHash);
        break;
      case "search_wordpress_commits":
        result = await getGitHubTools().searchCommits(args.query);
        break;
      default:
        throw new Error(`Unknown GitHub tool: ${toolName}`);
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
          text: `Error calling GitHub tool ${toolName}: ${
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
