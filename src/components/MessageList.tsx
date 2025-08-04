import { useEffect, useRef } from "react";
import { Message } from "../types";
import { User, Bot, AlertCircle, Loader2 } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

function MessageList({ messages, isLoading, error }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="message-list">
      {messages.length === 0 && !isLoading && !error && (
        <div className="welcome-message">
          <Bot className="welcome-icon" />
          <h3>Welcome to WordPress AI Assistant!</h3>
          <p>
            I can help you with WordPress development, troubleshooting, and
            general questions. I have access to WordPress.org resources and can
            provide detailed assistance.
          </p>
          <p>Try asking me something like:</p>
          <ul>
            <li>"How do I create a custom post type?"</li>
            <li>"What's the latest WordPress version?"</li>
            <li>"Help me debug a plugin issue"</li>
          </ul>
        </div>
      )}

      {messages.map((message) => (
        <div key={message.id} className={`message ${message.role}`}>
          <div className="message-avatar">
            {message.role === "user" ? <User size={20} /> : <Bot size={20} />}
          </div>
          <div className="message-content">
            <div className="message-text">{message.content}</div>
            <div className="message-time">{formatTime(message.timestamp)}</div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="message assistant">
          <div className="message-avatar">
            <Bot size={20} />
          </div>
          <div className="message-content">
            <div className="message-text loading">
              <Loader2 className="loading-spinner" size={16} />
              Thinking...
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>Error: {error}</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
