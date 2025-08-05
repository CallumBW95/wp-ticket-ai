import { useState, KeyboardEvent, useRef } from "react";
import { Send, Loader2 } from "lucide-react";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
  onHistoryNavigation: (direction: "up" | "down") => string | null;
}

function MessageInput({
  onSendMessage,
  disabled,
  onHistoryNavigation,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const [isNavigatingHistory, setIsNavigatingHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmedInput = input.trim();
    if (trimmedInput && !disabled) {
      onSendMessage(trimmedInput);
      setInput("");
      setIsNavigatingHistory(false);

      // Keep focus on the textarea after sending
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      setIsNavigatingHistory(false);
    } else if (e.key === "ArrowUp" && !e.shiftKey) {
      e.preventDefault();
      const historyMessage = onHistoryNavigation("up");
      if (historyMessage !== null) {
        setInput(historyMessage);
        setIsNavigatingHistory(true);
      }
    } else if (e.key === "ArrowDown" && !e.shiftKey) {
      e.preventDefault();
      const historyMessage = onHistoryNavigation("down");
      if (historyMessage !== null) {
        setInput(historyMessage);
        setIsNavigatingHistory(true);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Reset history navigation when user starts typing
    if (isNavigatingHistory) {
      setIsNavigatingHistory(false);
    }
  };

  return (
    <div className="message-input">
      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "WordPress AI is thinking..."
              : "Ask me anything about WordPress... (↑↓ for history)"
          }
          disabled={disabled}
          rows={1}
          style={{
            resize: "none",
            minHeight: "20px",
            maxHeight: "120px",
            overflow: "auto",
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={() => {
            handleSubmit();
            // Also keep focus when clicking the send button
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }, 0);
          }}
          disabled={disabled || !input.trim()}
          className="send-button"
          title={disabled ? "AI is processing..." : "Send message"}
        >
          {disabled ? (
            <Loader2 size={20} className="loading-spinner" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
