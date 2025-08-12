import { useState, useCallback, useEffect } from "react";
import { Message, ChatState } from "../types";
import { sendMessage, getQueueStatus } from "../services/gemini";
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
  const [queueStatus, setQueueStatus] = useState({
    queueLength: 0,
    isProcessing: false,
  });

  // Monitor queue status
  useEffect(() => {
    const interval = setInterval(() => {
      const status = getQueueStatus();
      setQueueStatus(status);
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  // Load conversation by ID
  const loadConversation = useCallback(async (convId: string) => {
    if (!convId) return;
    try {
      console.log("📥 Starting to load conversation:", convId);
      setIsLoadingConversation(true);

      const conversation = await getConversation(convId);
      console.log("📋 Raw conversation data from API:", {
        id: conversation.conversationId,
        title: conversation.title,
        messageCount: conversation.messageCount,
        messages: conversation.messages.map((m) => ({
          role: m.role,
          content: m.content.substring(0, 50) + "...",
          timestamp: m.timestamp,
        })),
        totalMessagesInArray: conversation.messages.length,
      });

      // Convert conversation messages to ChatBot message format
      const messages: Message[] = conversation.messages.map((msg) => ({
        id: `${msg.timestamp.getTime()}-${msg.role}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));

      console.log("🔄 Converted messages:", messages.length);

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

      console.log("✅ Conversation loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load conversation:", error);
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
    async (message: Message, toolsUsed?: string[], conversationId?: string) => {
      const targetConversationId = conversationId || currentConversationId;

      if (!targetConversationId) {
        console.warn("⚠️ Cannot save message: no conversation ID", {
          message,
          providedId: conversationId,
          currentId: currentConversationId,
        });
        return;
      }

      try {
        console.log("💾 Saving message to conversation:", {
          conversationId: targetConversationId,
          role: message.role,
          contentLength: message.content.length,
          contentPreview: message.content.substring(0, 100) + "...",
        });

        const ticketsReferenced = extractTicketNumbers(message.content);

        const result = await addMessageToConversation(targetConversationId, {
          role: message.role,
          content: message.content,
          ticketsReferenced,
          toolsUsed,
        });

        console.log("✅ Message saved successfully:", result);

        // Update conversation title if it changed
        if (onConversationUpdate && result.title) {
          console.log("🔄 Updating conversation title:", result.title);
          onConversationUpdate(targetConversationId, result.title);
        }
      } catch (error) {
        console.error("❌ Failed to save message to conversation:", error);
        // Log more details about the error
        if (error instanceof Error) {
          console.error("Error details:", {
            message: error.message,
            stack: error.stack,
            conversationId: targetConversationId,
            messageRole: message.role,
          });
        }
      }
    },
    [currentConversationId, onConversationUpdate]
  );

  // Create new conversation for first message if no conversation is active
  const ensureConversation = useCallback(
    async (firstMessage: Message): Promise<string> => {
      if (currentConversationId) {
        console.log("🔄 Using existing conversation:", currentConversationId);
        return currentConversationId;
      }

      try {
        console.log("🆕 Creating new conversation for message:", {
          role: firstMessage.role,
          contentLength: firstMessage.content.length,
        });

        const response = await createConversation({
          role: firstMessage.role,
          content: firstMessage.content,
        });

        console.log("✅ New conversation created:", response);
        console.log("🔍 New conversation details:", {
          conversationId: response.conversationId,
          title: response.title,
        });

        setCurrentConversationId(response.conversationId);

        if (onConversationUpdate) {
          console.log(
            "🔄 Notifying parent of new conversation:",
            response.conversationId
          );
          onConversationUpdate(response.conversationId, response.title);
        }

        return response.conversationId;
      } catch (error) {
        console.error("❌ Failed to create conversation:", error);
        throw error;
      }
    },
    [currentConversationId, onConversationUpdate]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      console.log(
        "🚀 handleSendMessage called with content:",
        content.substring(0, 50) + "..."
      );

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      try {
        console.log("🔍 Ensuring conversation exists...");
        // Ensure we have a conversation to save to and get the conversation ID
        const conversationId = await ensureConversation(userMessage);
        
        console.log("🔑 Got conversation ID:", conversationId);
        
        // Check if this is a new conversation (we didn't have a conversation ID before)
        const isNewConversation = !currentConversationId;
        
        // Set the conversation ID immediately
        setCurrentConversationId(conversationId);

        // Add message to history
        setMessageHistory((prev) => {
          const newHistory = [content, ...prev];
          // Keep only last 50 messages to prevent memory issues
          return newHistory.slice(0, 50);
        });

        // Reset history index
        setHistoryIndex(-1);

        console.log("📝 Adding user message to UI...");
        // Add user message and set loading state
        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage],
          isLoading: true,
          error: null,
        }));

        // Note: First user message is already saved during conversation creation
        // Only save additional messages to existing conversations
        if (!isNewConversation) {
          console.log("💾 Saving user message to existing conversation...");
          await saveMessageToConversation(userMessage, undefined, conversationId);
        } else {
          console.log("💾 Skipping user message save - already included in new conversation");
        }

        console.log("🤖 Sending message to AI...");
        // Send message to AI
        const response = await sendMessage(content);

        console.log("📨 AI response received, length:", response.length);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };

        console.log("📝 Adding assistant message to UI...");
        // Add assistant message to UI first
        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
        }));

        console.log("💾 Saving assistant message to conversation...");
        // Save assistant message to conversation using the conversation ID directly
        try {
          await saveMessageToConversation(
            assistantMessage,
            undefined,
            conversationId
          );
          console.log("✅ Assistant message saved successfully");
        } catch (saveError) {
          console.error(
            "❌ Failed to save assistant message to conversation:",
            saveError
          );
          // Don't throw the error - the message is already shown in the UI
          // We could add a visual indicator that the message wasn't saved
        }
      } catch (error) {
        console.error("❌ Error in handleSendMessage:", error);

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
          } else if (error.message.includes("model overloaded")) {
            userFriendlyMessage = "AI model is currently busy";
            actionableAdvice =
              "Please wait a moment and try again. The model is handling many requests.";
          } else if (error.message.includes("safety filters")) {
            userFriendlyMessage = "Message blocked by safety filters";
            actionableAdvice =
              "Please rephrase your message to avoid triggering safety filters.";
          } else if (error.message.includes("API key")) {
            userFriendlyMessage = "API configuration error";
            actionableAdvice =
              "Please check your API key configuration and try again.";
          } else if (error.message.includes("rate limit")) {
            userFriendlyMessage = "Too many requests";
            actionableAdvice =
              "Please wait a moment before sending another message.";
          } else {
            userFriendlyMessage = error.message;
            actionableAdvice =
              "Please try again or contact support if the problem persists.";
          }
        }

        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `❌ **${userFriendlyMessage}**\n\n${actionableAdvice}`,
          timestamp: new Date(),
        };

        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          isLoading: false,
          error: userFriendlyMessage,
        }));

        // Try to save the error message to the conversation if we have a conversation ID
        if (currentConversationId) {
          try {
            console.log("💾 Saving error message to conversation...");
            await saveMessageToConversation(
              errorMessage,
              undefined,
              currentConversationId
            );
            console.log("✅ Error message saved successfully");
          } catch (saveError) {
            console.error(
              "❌ Failed to save error message to conversation:",
              saveError
            );
          }
        }
      }
    },
    [
      ensureConversation,
      saveMessageToConversation,
      sendMessage,
      currentConversationId,
    ]
  );

  const handleClearChat = useCallback(() => {
    console.log("🧹 handleClearChat called - clearing all state");
    setChatState(initialState);
    setMessageHistory([]);
    setHistoryIndex(-1);
    setCurrentConversationId(null);

    // Notify parent component that conversation was cleared
    if (onConversationClear) {
      console.log("🔄 Notifying parent that conversation was cleared");
      onConversationClear();
    }
  }, [onConversationClear]);

  // Load conversation when conversationId prop changes
  useEffect(() => {
    console.log("🔍 useEffect triggered:", {
      conversationId,
      currentConversationId,
    });
    if (conversationId && conversationId !== currentConversationId) {
      console.log("🔄 Loading conversation:", conversationId);
      loadConversation(conversationId);
    } else if (!conversationId) {
      console.log("🧹 Clearing conversation - no conversationId provided");
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
          {queueStatus.queueLength > 0 && (
            <span
              className="queue-indicator"
              title={`${queueStatus.queueLength} request(s) in queue`}
            >
              ⏳ Queue: {queueStatus.queueLength}
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
