// API Configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// Validate API base URL
if (!API_BASE_URL) {
  console.warn(
    "API_BASE_URL not configured, using default: http://localhost:3001"
  );
}

export const API_ENDPOINTS = {
  // Tickets
  TICKETS: `${API_BASE_URL}/api/tickets`,
  TICKET_SEARCH: `${API_BASE_URL}/api/tickets/search`,
  TICKET_DETAILS: (id: string | number) => `${API_BASE_URL}/api/tickets/${id}`,
  TICKET_SAVE: `${API_BASE_URL}/api/tickets/save`,
  TICKET_SCRAPE: (id: string | number) =>
    `${API_BASE_URL}/api/tickets/scrape/${id}`,
  TICKET_RECENT: (days: number) => `${API_BASE_URL}/api/tickets/recent/${days}`,
  TICKET_STATS: `${API_BASE_URL}/api/tickets/stats/summary`,
  TICKET_BY_COMPONENT: (component: string) =>
    `${API_BASE_URL}/api/tickets?component=${encodeURIComponent(component)}`,
  TICKET_BY_STATUS: (status: string) =>
    `${API_BASE_URL}/api/tickets?status=${encodeURIComponent(status)}`,

  // MCP
  MCP: `${API_BASE_URL}/api/mcp`,

  // Conversations
  CONVERSATIONS: `${API_BASE_URL}/api/conversations`,
  CONVERSATION_DETAILS: (id: string) =>
    `${API_BASE_URL}/api/conversations/${id}`,
  CONVERSATION_MESSAGES: (id: string) =>
    `${API_BASE_URL}/api/conversations/${id}/messages`,

  // Health
  HEALTH: `${API_BASE_URL}/health`,
} as const;

// Helper function to get full URL for any endpoint
export function getApiUrl(
  endpoint: string,
  params?: Record<string, string | number>
): string {
  let url = endpoint;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  return url;
}
