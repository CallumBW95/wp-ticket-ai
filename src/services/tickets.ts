// Service to integrate WordPress Trac tickets with the chatbot
import { MCPToolCall } from "../types";

const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://your-api-domain.com" // Replace with your production API domain
    : "http://localhost:3001";

export interface TicketSearchResult {
  ticketId: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  component: string;
  updatedAt: string;
}

export interface TicketDetails {
  ticketId: number;
  url: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  component: string;
  version?: string;
  milestone?: string;
  owner?: string;
  reporter: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  comments: Array<{
    id: number;
    author: string;
    timestamp: string;
    content: string;
  }>;
}

export async function searchTickets(
  query: string,
  limit = 10
): Promise<TicketSearchResult[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tickets/search/${encodeURIComponent(
        query
      )}?limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error searching tickets:", error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error(
          "Ticket search endpoint not found. The database service may be unavailable"
        );
      } else if (error.message.includes("500")) {
        throw new Error(
          "Database error while searching tickets. Please try again later"
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error(
          "Network error while searching tickets. Check your connection"
        );
      } else {
        throw new Error(`Ticket search failed: ${error.message}`);
      }
    }

    throw new Error("Unknown error occurred while searching tickets");
  }
}

// Helper function to call MCP tools from frontend
async function callMCPFromFrontend(toolCall: MCPToolCall): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `req-${Date.now()}`,
        method: "tools/call",
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("Error calling MCP tool:", error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error(
          "MCP tool not found. The WordPress Trac integration may be unavailable"
        );
      } else if (error.message.includes("500")) {
        throw new Error(
          "WordPress Trac server error. The service may be temporarily down"
        );
      } else if (error.message.includes("timeout")) {
        throw new Error(
          "MCP request timeout. WordPress Trac may be slow to respond"
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error(
          "Cannot connect to WordPress Trac MCP service. Check your connection"
        );
      } else {
        throw new Error(`WordPress Trac integration error: ${error.message}`);
      }
    }

    throw new Error("Unknown error occurred while accessing WordPress Trac");
  }
}

// Helper function to save ticket to database
async function saveTicketToDatabase(ticketData: any): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ticketData),
    });

    if (!response.ok) {
      throw new Error(`Failed to save ticket: ${response.status}`);
    }

    console.log(`✅ Saved ticket ${ticketData.ticketId} to database`);
  } catch (error) {
    console.error("Error saving ticket to database:", error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        console.warn(
          "Ticket save endpoint not found. Database service may be unavailable"
        );
      } else if (error.message.includes("500")) {
        console.warn(
          "Database error while saving ticket. Data may not be persisted"
        );
      } else if (
        error.message.includes("validation") ||
        error.message.includes("schema")
      ) {
        console.warn(
          "Ticket data validation failed. Some fields may be invalid"
        );
      } else if (
        error.message.includes("duplicate") ||
        error.message.includes("unique")
      ) {
        console.warn(
          "Ticket already exists in database. Update operation may have failed"
        );
      } else {
        console.warn(`Ticket save failed: ${error.message}`);
      }
    }

    // Don't throw - we can still return the ticket data even if saving fails
    // This prevents the entire ticket fetch from failing due to save issues
  }
}

export async function getTicketDetails(
  ticketId: number
): Promise<TicketDetails | null> {
  try {
    // First, try to get the ticket from local database
    const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}`);

    if (response.ok) {
      const ticket = await response.json();

      // Check if we have placeholder comments and need real comment data
      if (ticket.comments && ticket.comments.length > 0) {
        const hasPlaceholderComments = ticket.comments.some(
          (comment: any) =>
            comment.content &&
            (comment.content.includes("Comment history not available") ||
              comment.content.includes(
                "Visit the ticket URL for full discussion"
              ))
        );

        if (hasPlaceholderComments) {
          console.log(
            `🔄 Detected placeholder comments for ticket ${ticketId}, fetching real comments...`
          );

          // Fetch ticket with real comment data using scraper
          const scrapedResponse = await fetch(
            `${API_BASE_URL}/api/tickets/scrape/${ticketId}`
          );
          if (scrapedResponse.ok) {
            return await scrapedResponse.json();
          }
        }
      }

      return ticket;
    }

    // If ticket not found in database (404), fetch from WordPress Trac
    if (response.status === 404) {
      console.log(
        `🔄 Ticket ${ticketId} not found locally, fetching from WordPress Trac...`
      );

      try {
        // Call MCP getTicket tool
        const mcpResult = await callMCPFromFrontend({
          name: "getTicket",
          arguments: {
            id: ticketId,
            includeComments: true,
            commentLimit: 50,
          },
        });

        if (mcpResult?.content?.length > 0) {
          // Parse the ticket data from MCP response
          const ticketContent = mcpResult.content[0].text;

          // Extract ticket information from the response text
          // This is a simplified parser - in a real implementation you'd want more robust parsing
          const ticketData = parseTicketFromMCPResponse(
            ticketContent,
            ticketId
          );

          if (ticketData) {
            // Check if MCP gave us placeholder comments
            const hasPlaceholderComments =
              ticketData.comments &&
              ticketData.comments.some(
                (comment: any) =>
                  comment.content &&
                  (comment.content.includes("Comment history not available") ||
                    comment.content.includes(
                      "Visit the ticket URL for full discussion"
                    ))
              );

            if (hasPlaceholderComments) {
              console.log(
                `🔄 MCP provided placeholder comments for ticket ${ticketId}, using scraper for real comments...`
              );

              // Use scraper to get real comment data
              try {
                const scrapedResponse = await fetch(
                  `${API_BASE_URL}/api/tickets/scrape/${ticketId}`
                );
                if (scrapedResponse.ok) {
                  return await scrapedResponse.json();
                }
              } catch (scrapeError) {
                console.warn(
                  `Failed to scrape ticket ${ticketId} for comments, using MCP data:`,
                  scrapeError
                );
              }
            }

            // Save to database for future use (with or without real comments)
            await saveTicketToDatabase(ticketData);

            // Return the ticket details
            return ticketData;
          }
        }
      } catch (mcpError) {
        console.error(
          `Failed to fetch ticket ${ticketId} from WordPress Trac:`,
          mcpError
        );
      }

      return null;
    }

    // Other errors
    throw new Error(`API request failed: ${response.status}`);
  } catch (error) {
    console.error("Error fetching ticket details:", error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error(
          `Ticket #${ticketId} not found in database or WordPress Trac`
        );
      } else if (error.message.includes("500")) {
        throw new Error(
          "Database or WordPress Trac server error while fetching ticket"
        );
      } else if (error.message.includes("timeout")) {
        throw new Error("Request timeout while fetching ticket data");
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error(
          "Network error while fetching ticket. Check your connection"
        );
      } else if (
        error.message.includes("parse") ||
        error.message.includes("JSON")
      ) {
        throw new Error("Invalid ticket data format received from server");
      } else {
        throw new Error(
          `Failed to fetch ticket #${ticketId}: ${error.message}`
        );
      }
    }

    throw new Error(
      `Unknown error occurred while fetching ticket #${ticketId}`
    );
  }
}

// Helper function to map MCP values to schema-compatible values
function mapTicketType(mcpType: string): string {
  const typeMap: { [key: string]: string } = {
    defect: "defect",
    "defect (bug)": "defect",
    bug: "defect",
    enhancement: "enhancement",
    "feature request": "feature request",
    feature: "feature request",
    task: "task",
  };

  const mapped = typeMap[mcpType.toLowerCase()];
  return mapped || "defect"; // Default to defect
}

function mapTicketStatus(mcpStatus: string): string {
  const statusMap: { [key: string]: string } = {
    new: "new",
    assigned: "assigned",
    accepted: "accepted",
    reviewing: "reviewing",
    testing: "testing",
    closed: "closed",
    reopened: "new", // Map reopened to new since we don't have reopened in our schema
    resolved: "closed",
    fixed: "closed",
    invalid: "closed",
    wontfix: "closed",
    duplicate: "closed",
  };

  const mapped = statusMap[mcpStatus.toLowerCase()];
  return mapped || "new"; // Default to new
}

function mapTicketPriority(mcpPriority: string): string {
  const priorityMap: { [key: string]: string } = {
    trivial: "trivial",
    minor: "minor",
    normal: "normal",
    major: "major",
    critical: "critical",
    blocker: "blocker",
    low: "minor",
    medium: "normal",
    high: "major",
  };

  const mapped = priorityMap[mcpPriority.toLowerCase()];
  return mapped || "normal"; // Default to normal
}

// Helper function to parse ticket data from MCP response
function parseTicketFromMCPResponse(
  content: string,
  ticketId: number
): TicketDetails | null {
  try {
    // Try to parse JSON structure from the MCP response
    let ticketData: any = null;

    // Look for JSON structure in the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        ticketData = JSON.parse(jsonMatch[0]);
      } catch (jsonError) {
        console.warn(
          "Failed to parse JSON from MCP response, falling back to text parsing"
        );
      }
    }

    let title = "";
    let description = "";
    let status = "";
    let priority = "";
    let component = "";
    let reporter = "";
    let type = "defect";
    let keywords: string[] = [];
    let comments: Array<{
      id: number;
      author: string;
      timestamp: string;
      content: string;
    }> = [];

    if (ticketData?.metadata?.ticket) {
      // Parse from structured JSON data
      const ticket = ticketData.metadata.ticket;
      title = ticket.summary || ticket.title || "";
      description = ticket.description || "";
      status = mapTicketStatus(ticket.status || "");
      priority = mapTicketPriority(ticket.priority || "normal");
      component = ticket.component || "general";
      reporter = ticket.reporter || "unknown";
      type = mapTicketType(ticket.type || "defect");

      if (ticket.keywords) {
        keywords = ticket.keywords
          .split(",")
          .map((k: string) => k.trim())
          .filter((k: string) => k);
      }

      // Parse comments
      if (ticketData.metadata.comments) {
        comments = ticketData.metadata.comments.map(
          (comment: any, index: number) => ({
            id: index + 1,
            author: comment.author || "unknown",
            timestamp: comment.timestamp || new Date().toISOString(),
            content: comment.comment || "",
          })
        );
      }
    } else {
      // Fallback to text parsing
      const lines = content.split("\n");

      for (const line of lines) {
        if (
          line.includes("Title:") ||
          line.includes("Summary:") ||
          line.includes('"title"')
        ) {
          title = line
            .split(":")
            .slice(1)
            .join(":")
            .trim()
            .replace(/['"]/g, "");
        } else if (line.includes("Status:")) {
          const rawStatus =
            line.split(":")[1]?.trim().replace(/['"]/g, "") || "";
          status = mapTicketStatus(rawStatus);
        } else if (line.includes("Priority:")) {
          const rawPriority =
            line.split(":")[1]?.trim().replace(/['"]/g, "") || "";
          priority = mapTicketPriority(rawPriority);
        } else if (line.includes("Component:")) {
          component = line.split(":")[1]?.trim().replace(/['"]/g, "") || "";
        } else if (line.includes("Reporter:")) {
          reporter = line.split(":")[1]?.trim().replace(/['"]/g, "") || "";
        } else if (line.includes("Type:")) {
          const rawType =
            line.split(":")[1]?.trim().replace(/['"]/g, "") || "defect";
          type = mapTicketType(rawType);
        }
      }
    }

    // If we couldn't parse basic info, return null
    if (!title) {
      console.warn(`Could not parse ticket ${ticketId} from MCP response`);
      return null;
    }

    // Create current timestamp for created/updated dates
    const now = new Date().toISOString();

    const result: TicketDetails = {
      ticketId,
      url: `https://core.trac.wordpress.org/ticket/${ticketId}`,
      title,
      description: description || content,
      type: mapTicketType(type) as any,
      status: mapTicketStatus(status || "new"),
      priority: mapTicketPriority(priority || "normal"),
      component: component || "general",
      reporter: reporter || "unknown",
      keywords,
      createdAt: now,
      updatedAt: now,
      comments,
    };

    console.log(`✅ Successfully parsed ticket ${ticketId}:`, {
      title: result.title,
      status: result.status,
      priority: result.priority,
      component: result.component,
    });

    return result;
  } catch (error) {
    console.error("Error parsing ticket from MCP response:", error);
    return null;
  }
}

export async function getRecentTickets(
  days = 7
): Promise<TicketSearchResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets/recent/${days}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching recent tickets:", error);
    return [];
  }
}

export async function getTicketStats(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets/stats/summary`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching ticket stats:", error);
    return null;
  }
}

export async function getTicketsByComponent(
  component: string,
  limit = 20
): Promise<TicketSearchResult[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tickets?component=${encodeURIComponent(
        component
      )}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.tickets || [];
  } catch (error) {
    console.error("Error fetching tickets by component:", error);
    return [];
  }
}

export async function getTicketsByStatus(
  status: string,
  limit = 20
): Promise<TicketSearchResult[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tickets?status=${encodeURIComponent(
        status
      )}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.tickets || [];
  } catch (error) {
    console.error("Error fetching tickets by status:", error);
    return [];
  }
}

// Get ticket with full comment data using scraper
export async function getTicketWithFullComments(
  ticketId: number
): Promise<TicketDetails | null> {
  try {
    console.log(`🔄 Getting ticket ${ticketId} with full comment data...`);

    // Always use the scraper endpoint for this function to ensure real comments
    const response = await fetch(
      `${API_BASE_URL}/api/tickets/scrape/${ticketId}`
    );

    if (response.ok) {
      const ticket = await response.json();
      console.log(
        `✅ Retrieved ticket ${ticketId} with ${
          ticket.comments?.length || 0
        } comments`
      );
      return ticket;
    }

    if (response.status === 404) {
      console.log(`❌ Ticket ${ticketId} not found`);
      return null;
    }

    throw new Error(`Failed to fetch ticket: ${response.status}`);
  } catch (error) {
    console.error(`Error fetching ticket ${ticketId} with comments:`, error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error(`Ticket #${ticketId} not found in WordPress Trac`);
      } else if (error.message.includes("500")) {
        throw new Error("WordPress Trac scraper service error");
      } else if (error.message.includes("timeout")) {
        throw new Error(
          "Scraper timeout - WordPress Trac may be slow to respond"
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Network error while scraping WordPress Trac");
      } else if (
        error.message.includes("parse") ||
        error.message.includes("HTML")
      ) {
        throw new Error("Failed to parse WordPress Trac page content");
      } else {
        throw new Error(
          `Scraper error for ticket #${ticketId}: ${error.message}`
        );
      }
    }

    throw new Error(
      `Unknown error occurred while scraping ticket #${ticketId}`
    );
  }
}
