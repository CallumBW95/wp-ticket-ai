import { useEffect, useRef, useMemo, useState } from "react";
import { Message } from "../types";
import { User, Bot, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

// Custom code block component with copy button
function CodeBlock({ className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const isCodeBlock = !props.inline && match;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(children));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  if (!isCodeBlock) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-language">{match[1]}</span>
        <button
          className="copy-button"
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <pre className={className}>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// Function to highlight WordPress Trac usernames with subtle styling
function highlightUsernames(text: string): string {
  // Only highlight @username format - very conservative approach
  const usernamePattern = /@([a-zA-Z][a-zA-Z0-9_-]{2,20})/g;

  return text.replace(usernamePattern, (match, username) => {
    // Skip if it's already wrapped in HTML tags
    if (match.includes("<") || match.includes(">")) {
      return match;
    }

    // Only highlight @username format
    return `<span class="username-highlight">@${username}</span>`;
  });
}

function MessageList({ messages, isLoading, error }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Array of engaging loading messages
  const loadingMessages = useMemo(
    () => [
      "WordPress AI is thinking",
      "Analyzing WordPress best practices",
      "Consulting the WordPress codex",
      "Checking latest WordPress updates",
      "Reviewing plugin compatibility",
      "Searching WordPress documentation",
      "Processing your WordPress question",
      "Analyzing WordPress core",
    ],
    []
  );

  // Pick a random loading message
  const loadingMessage = useMemo(() => {
    return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
  }, [isLoading, loadingMessages]);

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
            <div className="message-text">
              {message.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code: CodeBlock,
                    h1: ({ children }) => (
                      <h1 className="markdown-h1">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="markdown-h2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="markdown-h3">{children}</h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="markdown-h4">{children}</h4>
                    ),
                    h5: ({ children }) => (
                      <h5 className="markdown-h5">{children}</h5>
                    ),
                    h6: ({ children }) => (
                      <h6 className="markdown-h6">{children}</h6>
                    ),
                    ul: ({ children }) => (
                      <ul className="markdown-ul">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="markdown-ol">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="markdown-li">{children}</li>
                    ),
                    p: ({ children }) => (
                      <p className="markdown-p">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="markdown-strong">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="markdown-em">{children}</em>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="markdown-blockquote">
                        {children}
                      </blockquote>
                    ),
                    table: ({ children }) => (
                      <table className="markdown-table">{children}</table>
                    ),
                    thead: ({ children }) => (
                      <thead className="markdown-thead">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="markdown-tbody">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="markdown-tr">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="markdown-th">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="markdown-td">{children}</td>
                    ),
                  }}
                >
                  {highlightUsernames(message.content)}
                </ReactMarkdown>
              ) : (
                message.content
              )}
            </div>
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
              <span>{loadingMessage}</span>
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <div className="error-header">
            <AlertCircle size={20} />
            <span className="error-title">Error</span>
          </div>
          <div className="error-content">
            {error.split("\n").map((line, index) => (
              <div
                key={index}
                className={
                  line.startsWith("💡") ? "error-advice" : "error-text"
                }
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
