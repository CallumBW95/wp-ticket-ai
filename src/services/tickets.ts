// Service to integrate WordPress Trac tickets with the chatbot

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
    return [];
  }
}

export async function getTicketDetails(
  ticketId: number
): Promise<TicketDetails | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching ticket details:", error);
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
