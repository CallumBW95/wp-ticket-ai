import { useState, useEffect } from "react";
import ChatBot from "./components/ChatBot";
import { initializeServices } from "./services/initialization";
import "./App.css";

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>WP Aggregator AI Chat Bot</h1>
        <p>Powered by Google Gemini with WordPress MCP Server</p>
      </header>
      <main className="app-main">
        <ChatBot />
      </main>
    </div>
  );
}

export default App;
