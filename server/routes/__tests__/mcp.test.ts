import request from "supertest";
import express from "express";
import mcpRouter from "../mcp";

const app = express();
app.use(express.json());
app.use("/api/mcp", mcpRouter);

// Mock fetch to avoid actual external calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper function to create a complete mock Response object
const createMockResponse = (options: {
  ok: boolean;
  status: number;
  statusText: string;
  text: string | (() => Promise<string>);
  json?: any;
  headers?: Record<string, string>;
}) => {
  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    headers: {
      entries: () => Object.entries(options.headers || {}),
      get: (name: string) => (options.headers || {})[name] || null,
    },
    text: async () => typeof options.text === 'string' ? options.text : await options.text(),
    json: async () => options.json || JSON.parse(typeof options.text === 'string' ? options.text : await options.text()),
  };
};

describe("MCP API", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Set up MCP server URL for tests
    process.env.MCP_SERVER_URL = "http://test-mcp-server:3000";
  });

  describe("POST /", () => {
    it("should proxy requests to MCP server", async () => {
      const mockResponse = {
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [
            {
              type: "text",
              text: "Test response from MCP server",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          text: JSON.stringify(mockResponse),
          headers: { "content-type": "application/json" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("mcp-server"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "Accept-Encoding": "identity",
          }),
          body: JSON.stringify(requestData),
        })
      );
    });

    it("should handle MCP server errors", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: "MCP server error",
          headers: { "content-type": "text/plain" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("MCP server error");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("Failed to proxy MCP request");
    });

    it("should handle invalid JSON in request body", async () => {
      const response = await request(app)
        .post("/api/mcp/")
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(response.status).toBe(400);
    });

    it("should handle missing request body", async () => {
      const response = await request(app).post("/api/mcp/");

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("Failed to proxy MCP request");
    });

    it("should handle MCP server returning invalid JSON", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          text: "invalid json content",
          headers: { "content-type": "application/json" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("Invalid JSON");
    });

    it("should handle timeout errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("timeout"));

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("Failed to proxy MCP request");
    });

    it("should handle 404 errors from MCP server", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: "MCP endpoint not found",
          headers: { "content-type": "text/plain" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("MCP server error: 404 Not Found");
    });

    it("should handle 403 errors from MCP server", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          text: "Access denied",
          headers: { "content-type": "text/plain" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("MCP server error: 403 Forbidden");
    });

    it("should handle 401 errors from MCP server", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: "Authentication required",
          headers: { "content-type": "text/plain" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain(
        "MCP server error: 401 Unauthorized"
      );
    });

    it("should handle 422 errors from MCP server", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          text: "Invalid request parameters",
          headers: { "content-type": "text/plain" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(422);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain(
        "MCP server error: 422 Unprocessable Entity"
      );
    });

    it("should handle 502 errors from MCP server", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 502,
          statusText: "Bad Gateway",
          text: "MCP server unavailable",
          headers: { "content-type": "text/plain" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(502);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain(
        "MCP server error: 502 Bad Gateway"
      );
    });

    it("should handle complex JSON-RPC requests", async () => {
      const mockResponse = {
        jsonrpc: "2.0",
        id: "complex-id",
        result: {
          content: [
            {
              type: "text",
              text: "Complex response",
            },
          ],
          isError: false,
        },
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          text: JSON.stringify(mockResponse),
          headers: { "content-type": "application/json" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: "complex-id",
        method: "tools/call",
        params: {
          name: "complex_tool",
          arguments: {
            param1: "value1",
            param2: 123,
            param3: {
              nested: "object",
            },
            param4: ["array", "of", "values"],
          },
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("mcp-server"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestData),
        })
      );
    });

    it("should handle JSON-RPC error responses", async () => {
      const mockErrorResponse = {
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32601,
          message: "Method not found",
          data: {
            method: "nonexistent_method",
          },
        },
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          text: JSON.stringify(mockErrorResponse),
          headers: { "content-type": "application/json" },
        })
      );

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "nonexistent_method",
        params: {},
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockErrorResponse);
      expect(response.body.error.code).toBe(-32601);
      expect(response.body.error.message).toBe("Method not found");
    });

    it("should handle large request bodies", async () => {
      const mockResponse = {
        jsonrpc: "2.0",
        id: 1,
        result: { success: true },
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          text: JSON.stringify(mockResponse),
          headers: { "content-type": "application/json" },
        })
      );

      const largeData = "x".repeat(10000);
      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "large_data_tool",
          arguments: {
            largeContent: largeData,
          },
        },
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("mcp-server"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestData),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle missing MCP server URL", async () => {
      // Temporarily remove MCP server URL from environment
      const originalUrl = process.env.MCP_SERVER_URL;
      delete process.env.MCP_SERVER_URL;

      const requestData = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {},
      };

      const response = await request(app).post("/api/mcp/").send(requestData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("Failed to proxy MCP request");

      // Restore environment variable
      if (originalUrl) {
        process.env.MCP_SERVER_URL = originalUrl;
      }
    });

    it("should handle malformed request headers", async () => {
      const response = await request(app)
        .post("/api/mcp/")
        .set("Content-Type", "text/plain")
        .send("not json");

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("Failed to proxy MCP request");
    });

    it("should handle empty request body", async () => {
      const response = await request(app).post("/api/mcp/").send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("Failed to proxy MCP request");
    });
  });
});
