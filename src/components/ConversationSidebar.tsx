import { useState, useEffect } from "react";
import { MessageSquare, Archive, Trash2, Plus } from "lucide-react";
import {
  listConversations,
  deleteConversation,
  formatRelativeTime,
} from "../services/conversations";

interface ConversationSummary {
  _id: string;
  conversationId: string;
  title: string;
  ticketNumbers: number[];
  topics: string[];
  messageCount: number;
  lastActivity: string;
  createdAt: string;
  isArchived: boolean;
}

interface ConversationSidebarProps {
  isOpen: boolean;
  currentConversationId?: string | null;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
}

export default function ConversationSidebar({
  isOpen,
  currentConversationId,
  onConversationSelect,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listConversations();
      setConversations(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversations"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const handleDeleteConversation = async (
    conversationId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      try {
        await deleteConversation(conversationId);
        setConversations((prev) =>
          prev.filter((c) => c.conversationId !== conversationId)
        );
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }
    }
  };

  const formatConversationTitle = (
    conversation: ConversationSummary
  ): string => {
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
    return `Chat Session - ${new Date(
      conversation.createdAt
    ).toLocaleDateString()}`;
  };

  return (
    <div className={`conversation-sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <h2>Conversations</h2>
        <button
          className="new-conversation-btn"
          onClick={onNewConversation}
          aria-label="Start new conversation"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      <div className="sidebar-content">
        {isLoading && (
          <div className="sidebar-loading">
            <div className="loading-spinner"></div>
            <span>Loading conversations...</span>
          </div>
        )}

        {error && (
          <div className="sidebar-error">
            <span>Error loading conversations</span>
            <button onClick={loadConversations} className="retry-btn">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && conversations.length === 0 && (
          <div className="sidebar-empty">
            <MessageSquare size={48} />
            <p>No conversations yet</p>
            <p>Start a new chat to begin</p>
          </div>
        )}

        {!isLoading && !error && conversations.length > 0 && (
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <div
                key={conversation.conversationId}
                className={`conversation-item ${
                  currentConversationId === conversation.conversationId
                    ? "active"
                    : ""
                } ${conversation.isArchived ? "archived" : ""}`}
                onClick={() =>
                  onConversationSelect(conversation.conversationId)
                }
              >
                <div className="conversation-content">
                  <div className="conversation-title">
                    {conversation.isArchived && <Archive size={14} />}
                    {formatConversationTitle(conversation)}
                  </div>
                  <div className="conversation-meta">
                    <span className="message-count">
                      {conversation.messageCount} messages
                    </span>
                    <span className="last-activity">
                      {formatRelativeTime(conversation.lastActivity)}
                    </span>
                  </div>
                  {conversation.ticketNumbers.length > 0 && (
                    <div className="conversation-tickets">
                      {conversation.ticketNumbers.map((ticketId) => (
                        <span key={ticketId} className="ticket-badge">
                          #{ticketId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="delete-conversation-btn"
                  onClick={(e) =>
                    handleDeleteConversation(conversation.conversationId, e)
                  }
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
