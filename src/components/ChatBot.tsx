import { useState, useCallback, useEffect } from "react";
import { Message, ChatState } from "../types";
import { sendMessage } from "../services/gemini";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import {
  getConversation,
  addMessageToConversation,
  createConversation,
  extractTicketNumbers,
} from "../services/conversations";
import { IChatConversation } from "../../server/models/ChatConversation";
import { Plus } from "lucide-react";

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
};

interface ChatBotProps {
  conversationId?: string;
  onConversationUpdate?: (conversationId: string, title: string) => void;
  onConversationClear?: () => void;
  onSidebarToggle?: () => void;
  isSidebarOpen?: boolean;
}

function ChatBot({
  conversationId,
  onConversationUpdate,
  onConversationClear,
  onSidebarToggle,
  isSidebarOpen,
}: ChatBotProps) {
  const [chatState, setChatState] = useState<ChatState>(initialState);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(conversationId || null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // Load conversation when conversationId changes
  const loadConversation = useCallback(async (convId: string) => {
    if (!convId) return;

    try {
      setIsLoadingConversation(true);
      const conversation = await getConversation(convId);

      // Convert conversation messages to ChatBot message format
      const messages: Message[] = conversation.messages.map((msg) => ({
        id: `${msg.timestamp.getTime()}-${msg.role}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));

      setChatState({
        messages,
        isLoading: false,
        error: null,
      });

      setCurrentConversationId(convId);

      // Update message history for input navigation
      const userMessages = conversation.messages
        .filter((msg) => msg.role === "user")
        .map((msg) => msg.content)
        .reverse();
      setMessageHistory(userMessages);
      setHistoryIndex(-1);
    } catch (error) {
      console.error("Failed to load conversation:", error);
      setChatState((prev) => ({
        ...prev,
        error: "Failed to load conversation",
      }));
    } finally {
      setIsLoadingConversation(false);
    }
  }, []);

  // Save message to conversation
  const saveMessageToConversation = useCallback(
    async (message: Message, toolsUsed?: string[]) => {
      if (!currentConversationId) {
        console.warn("Cannot save message: no current conversation ID", {
          message,
        });
        return;
      }

      try {
        const ticketsReferenced = extractTicketNumbers(message.content);

        const result = await addMessageToConversation(currentConversationId, {
          role: message.role,
          content: message.content,
          ticketsReferenced,
          toolsUsed,
        });

        // Update conversation title if it changed
        if (onConversationUpdate && result.title) {
          onConversationUpdate(currentConversationId, result.title);
        }
      } catch (error) {
        console.error("Failed to save message to conversation:", error);
      }
    },
    [currentConversationId, onConversationUpdate]
  );

  // Create new conversation for first message if no conversation is active
  const ensureConversation = useCallback(
    async (firstMessage: Message): Promise<string> => {
      if (currentConversationId) {
        return currentConversationId;
      }

      try {
        const response = await createConversation({
          role: firstMessage.role,
          content: firstMessage.content,
        });

        setCurrentConversationId(response.conversationId);

        if (onConversationUpdate) {
          onConversationUpdate(response.conversationId, response.title);
        }

        return response.conversationId;
      } catch (error) {
        console.error("Failed to create conversation:", error);
        throw error;
      }
    },
    [currentConversationId, onConversationUpdate]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      try {
        // Ensure we have a conversation to save to
        await ensureConversation(userMessage);

        // Add message to history
        setMessageHistory((prev) => {
          const newHistory = [content, ...prev];
          // Keep only last 50 messages to prevent memory issues
          return newHistory.slice(0, 50);
        });

        // Reset history index
        setHistoryIndex(-1);

        // Add user message and set loading state
        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage],
          isLoading: true,
          error: null,
        }));

        // Save user message to conversation
        await saveMessageToConversation(userMessage);

        // Send message to AI
        const response = await sendMessage(content);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };

        // Add assistant message to UI first
        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
        }));

        // Save assistant message to conversation (don't let this fail the whole operation)
        try {
          await saveMessageToConversation(assistantMessage);
        } catch (saveError) {
          console.error(
            "Failed to save assistant message to conversation:",
            saveError
          );
          // Don't throw the error - the message is already shown in the UI
          // We could add a visual indicator that the message wasn't saved
        }
      } catch (error) {
        console.error("Error in handleSendMessage:", error);

        // Enhanced frontend error handling
        let userFriendlyMessage = "Something went wrong";
        let actionableAdvice = "";

        if (error instanceof Error) {
          // Check for specific error types
          if (error.name === "GeminiError") {
            userFriendlyMessage = error.message;
            // Gemini errors already include actionable advice
          } else if (error.message.includes("Failed to create conversation")) {
            userFriendlyMessage = "Unable to start conversation";
            actionableAdvice = "Check your internet connection and try again";
          } else if (error.message.includes("Failed to save message")) {
            userFriendlyMessage = "Message couldn't be saved";
            actionableAdvice = "Your message was sent but not saved to history";
          } else if (
            error.message.includes("network") ||
            error.message.includes("fetch")
          ) {
            userFriendlyMessage = "Network connection error";
            actionableAdvice =
              "Please check your internet connection and try again";
          } else if (error.message.includes("timeout")) {
            userFriendlyMessage = "Request timed out";
            actionableAdvice =
              "The request took too long. Try sending a shorter message";
          } else if (
            error.message.includes("rate limit") ||
            error.message.includes("quota")
          ) {
            userFriendlyMessage = "Service temporarily unavailable";
            actionableAdvice =
              "Too many requests. Please wait a moment before trying again";
          } else if (
            error.message.includes("overloaded") ||
            error.message.includes("503")
          ) {
            userFriendlyMessage = "AI model is currently overloaded";
            actionableAdvice =
              "Google's servers are experiencing high demand. The system will automatically retry, or you can wait a few minutes and try again";
          } else if (
            error.message.includes("authentication") ||
            error.message.includes("API key")
          ) {
            userFriendlyMessage = "Authentication error";
            actionableAdvice =
              "There's an issue with the AI service configuration";
          } else {
            userFriendlyMessage = error.message;
            actionableAdvice =
              "If this problem persists, please refresh the page";
          }
        }

        const fullErrorMessage = actionableAdvice
          ? `${userFriendlyMessage}\n\n💡 ${actionableAdvice}`
          : userFriendlyMessage;

        // Create an error message to show in the chat
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `❌ **Error**: ${userFriendlyMessage}${
            actionableAdvice ? `\n\n💡 **Suggestion**: ${actionableAdvice}` : ""
          }`,
          timestamp: new Date(),
        };

        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          isLoading: false,
          error: null, // Clear any global error state
        }));

        // Try to save the error message to conversation
        try {
          await saveMessageToConversation(errorMessage);
        } catch (saveError) {
          console.error(
            "Failed to save error message to conversation:",
            saveError
          );
        }
      }
    },
    [ensureConversation, saveMessageToConversation]
  );

  const handleClearChat = useCallback(() => {
    setChatState(initialState);
    setMessageHistory([]);
    setHistoryIndex(-1);
    setCurrentConversationId(null);

    // Notify parent component that conversation was cleared
    if (onConversationClear) {
      onConversationClear();
    }
  }, [onConversationClear]);

  // Load conversation when conversationId prop changes
  useEffect(() => {
    if (conversationId && conversationId !== currentConversationId) {
      loadConversation(conversationId);
    } else if (!conversationId) {
      // Clear current conversation if no conversationId provided
      handleClearChat();
    }
  }, [
    conversationId,
    currentConversationId,
    loadConversation,
    handleClearChat,
  ]);

  const handleHistoryNavigation = useCallback(
    (direction: "up" | "down"): string | null => {
      if (messageHistory.length === 0) return null;

      let newIndex = historyIndex;

      if (direction === "up") {
        newIndex = Math.min(historyIndex + 1, messageHistory.length - 1);
      } else {
        newIndex = Math.max(historyIndex - 1, -1);
      }

      setHistoryIndex(newIndex);

      // Return the message at the new index, or empty string if back to current
      return newIndex === -1 ? "" : messageHistory[newIndex];
    },
    [messageHistory, historyIndex]
  );

  return (
    <div className="chatbot">
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          {onSidebarToggle && (
            <button
              className="sidebar-toggle-btn"
              onClick={onSidebarToggle}
              aria-label="Toggle conversation sidebar"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  width: "20px",
                  height: "20px",
                  minWidth: "20px",
                  minHeight: "20px",
                }}
              >
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}
          <div className="chatbot-header-text">
            <h1>WP Aggregator AI Chat Bot</h1>
          </div>
        </div>
        <div className="chatbot-header-actions">
          {currentConversationId && (
            <span
              className="conversation-indicator"
              title={`Conversation: ${currentConversationId.substring(
                0,
                8
              )}...`}
            >
              💬 Active
            </span>
          )}
          <button
            onClick={handleClearChat}
            className="clear-button"
            disabled={chatState.isLoading || isLoadingConversation}
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>
      </div>

      {isLoadingConversation ? (
        <div className="loading-conversation">
          <div className="loading-spinner"></div>
          <p>Loading conversation...</p>
        </div>
      ) : (
        <>
          <MessageList
            messages={chatState.messages}
            isLoading={chatState.isLoading}
            error={chatState.error}
          />

          <MessageInput
            onSendMessage={handleSendMessage}
            disabled={chatState.isLoading || isLoadingConversation}
            onHistoryNavigation={handleHistoryNavigation}
          />
        </>
      )}
    </div>
  );
}

export default ChatBot;
