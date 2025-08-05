import express from "express";

const router = express.Router();

const MCP_SERVER_URL =
  "https://mcp-server-wporg-trac-staging.a8cai.workers.dev/mcp";

// Proxy MCP requests to avoid CORS issues
router.post("/", async (req, res) => {
  try {
    console.log("🔄 Proxying MCP request:", req.body);

    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "identity", // Disable compression
        "User-Agent": "WP-Aggregator-AI/1.0.0",
      },
      body: JSON.stringify(req.body),
    });

    console.log("📡 MCP server response status:", response.status);
    console.log(
      "📡 MCP server response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ MCP server error response:", errorText);
      return res.status(response.status).json({
        error: `MCP server error: ${response.status} ${response.statusText}`,
        details: errorText,
      });
    }

    const responseText = await response.text();
    console.log("📝 Raw MCP response:", responseText.substring(0, 200));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse MCP response as JSON:", parseError);
      console.error("❌ Response was:", responseText);
      return res.status(500).json({
        error: "Invalid JSON response from MCP server",
        details: `Parse error: ${
          parseError instanceof Error ? parseError.message : "Unknown"
        }`,
      });
    }

    console.log("✅ Successfully parsed MCP response:", data);

    // Set CORS headers for the frontend
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    res.status(response.status).json(data);
  } catch (error) {
    console.error("MCP Proxy Error:", error);
    res.status(500).json({
      error: "Failed to proxy MCP request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Handle preflight OPTIONS requests
router.options("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(200);
});

export default router;
