import { useState, useCallback } from "react";
import { Message, ChatState } from "../types";
import { sendMessage } from "../services/gemini";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
};

function ChatBot() {
  const [chatState, setChatState] = useState<ChatState>(initialState);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    // Add user message and set loading state
    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await sendMessage(content);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";

      setChatState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  const handleClearChat = useCallback(() => {
    setChatState(initialState);
  }, []);

  return (
    <div className="chatbot">
      <div className="chatbot-header">
        <h2>WordPress AI Assistant</h2>
        <button
          onClick={handleClearChat}
          className="clear-button"
          disabled={chatState.isLoading}
        >
          Clear Chat
        </button>
      </div>

      <MessageList
        messages={chatState.messages}
        isLoading={chatState.isLoading}
        error={chatState.error}
      />

      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={chatState.isLoading}
      />
    </div>
  );
}

export default ChatBot;
