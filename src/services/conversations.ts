import {
  IConversationMessage,
  IChatConversation,
} from "../../server/models/ChatConversation.js";

const API_BASE_URL = "http://localhost:3001"; // Your backend API base URL

export interface ConversationSummary {
  conversationId: string;
  title: string;
  ticketNumbers: number[];
  topics: string[];
  messageCount: number;
  lastActivity: string;
  createdAt: string;
  isArchived: boolean;
}

export async function createConversation(
  initialMessage: Omit<IConversationMessage, "timestamp">
): Promise<{ conversationId: string; title: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initialMessage }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to create conversation: ${
          errorData.error || response.statusText
        }`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating conversation:", error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error("Conversation service endpoint not found");
      } else if (error.message.includes("500")) {
        throw new Error("Database error while creating conversation");
      } else if (
        error.message.includes("validation") ||
        error.message.includes("schema")
      ) {
        throw new Error("Invalid conversation data format");
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Network error while creating conversation");
      } else {
        throw new Error(`Failed to create conversation: ${error.message}`);
      }
    }

    throw new Error("Unknown error occurred while creating conversation");
  }
}

export async function getConversation(
  conversationId: string
): Promise<IChatConversation> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/conversations/${conversationId}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to load conversation: ${errorData.error || response.statusText}`
      );
    }

    const conversation: IChatConversation = await response.json();
    // Convert string timestamps back to Date objects
    conversation.messages = conversation.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
    return conversation;
  } catch (error) {
    console.error(`Error loading conversation ${conversationId}:`, error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error(`Conversation "${conversationId}" not found`);
      } else if (error.message.includes("500")) {
        throw new Error("Database error while loading conversation");
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Network error while loading conversation");
      } else if (
        error.message.includes("parse") ||
        error.message.includes("JSON")
      ) {
        throw new Error("Invalid conversation data format received");
      } else {
        throw new Error(`Failed to load conversation: ${error.message}`);
      }
    }

    throw new Error(
      `Unknown error occurred while loading conversation "${conversationId}"`
    );
  }
}

export async function listConversations(): Promise<ConversationSummary[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to list conversations: ${
          errorData.error || response.statusText
        }`
      );
    }

    const data = await response.json();
    return data.conversations || [];
  } catch (error) {
    console.error("Error listing conversations:", error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error("Conversations list endpoint not found");
      } else if (error.message.includes("500")) {
        throw new Error("Database error while listing conversations");
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Network error while loading conversations list");
      } else if (
        error.message.includes("parse") ||
        error.message.includes("JSON")
      ) {
        throw new Error("Invalid conversations data format received");
      } else {
        throw new Error(`Failed to list conversations: ${error.message}`);
      }
    }

    throw new Error("Unknown error occurred while listing conversations");
  }
}

export async function deleteConversation(
  conversationId: string
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/conversations/${conversationId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to delete conversation: ${
          errorData.error || response.statusText
        }`
      );
    }
  } catch (error) {
    console.error(`Error deleting conversation ${conversationId}:`, error);

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error(`Conversation "${conversationId}" not found`);
      } else if (error.message.includes("500")) {
        throw new Error("Database error while deleting conversation");
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Network error while deleting conversation");
      } else {
        throw new Error(`Failed to delete conversation: ${error.message}`);
      }
    }

    throw new Error("Unknown error occurred while deleting conversation");
  }
}

export async function addMessageToConversation(
  conversationId: string,
  message: Omit<IConversationMessage, "timestamp">
): Promise<{ success: boolean; title?: string }> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to add message to conversation: ${
          errorData.error || response.statusText
        }`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      `Error adding message to conversation ${conversationId}:`,
      error
    );

    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error(`Conversation "${conversationId}" not found`);
      } else if (error.message.includes("500")) {
        throw new Error("Database error while saving message");
      } else if (
        error.message.includes("validation") ||
        error.message.includes("schema")
      ) {
        throw new Error("Invalid message format");
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Network error while saving message");
      } else {
        throw new Error(`Failed to save message: ${error.message}`);
      }
    }

    throw new Error(
      `Unknown error occurred while saving message to conversation "${conversationId}"`
    );
  }
}

// Helper function to extract ticket numbers from text
export function extractTicketNumbers(text: string): number[] {
  const regex = /(?:ticket|trac)\s*#?(\d{4,6})/gi;
  const matches = [...text.matchAll(regex)];
  const ticketIds = matches
    .map((match) => parseInt(match[1]))
    .filter((id) => id >= 1000 && id <= 999999); // Reasonable ticket number range
  return [...new Set(ticketIds)].sort((a, b) => a - b); // Return unique ticket IDs sorted
}

// Helper function to format conversation title for display
export function formatConversationTitle(
  conversation: ConversationSummary
): string {
  // Priority 1: Ticket numbers
  if (conversation.ticketNumbers.length === 1) {
    return `Ticket #${conversation.ticketNumbers[0]}`;
  } else if (
    conversation.ticketNumbers.length > 1 &&
    conversation.ticketNumbers.length <= 3
  ) {
    return `Tickets #${conversation.ticketNumbers.join(", #")}`;
  } else if (conversation.ticketNumbers.length > 3) {
    return `${conversation.ticketNumbers.length} WordPress Tickets`;
  }

  // Priority 2: Topics
  if (conversation.topics.length > 0) {
    return `${conversation.topics[0]} Discussion`;
  }

  // Priority 3: Use existing title if meaningful
  if (
    conversation.title &&
    !conversation.title.startsWith("Chat Session -") &&
    !conversation.title.startsWith("New Conversation")
  ) {
    return conversation.title;
  }

  // Fallback: Date-based title
  const date = new Date(conversation.createdAt).toLocaleDateString();
  return `Chat - ${date}`;
}

// Helper function to format relative time
export function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  } else {
    return `${diffYears}y ago`;
  }
}
