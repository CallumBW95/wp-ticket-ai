import { useState, useEffect } from "react";
import ChatBot from "./components/ChatBot";
import ConversationSidebar from "./components/ConversationSidebar";
import { initializeServices } from "./services/initialization";
import "./App.css";

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeServices();
        setIsInitialized(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to initialize services"
        );
      }
    };

    initialize();
  }, []);

  if (error) {
    return (
      <div className="app error">
        <h1>Initialization Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="app loading">
        <h1>Initializing WP Aggregator AI...</h1>
        <p>Connecting to services...</p>
      </div>
    );
  }

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setIsSidebarOpen(false);
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setIsSidebarOpen(false);
  };

  return (
    <div className="app">
      <ConversationSidebar
        isOpen={isSidebarOpen}
        currentConversationId={currentConversationId}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
      />

      <main className={`app-main ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <ChatBot
          conversationId={currentConversationId}
          onConversationUpdate={(conversationId, title) => {
            setCurrentConversationId(conversationId);
          }}
          onConversationClear={() => {
            setCurrentConversationId(null);
          }}
          onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />
      </main>
    </div>
  );
}

export default App;
