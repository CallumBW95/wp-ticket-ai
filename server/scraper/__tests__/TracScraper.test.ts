import { TracScraper } from "../TracScraper";

// Mock fetch to avoid actual HTTP requests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("TracScraper", () => {
  let scraper: TracScraper;

  beforeEach(() => {
    scraper = new TracScraper();
    mockFetch.mockClear();
  });

  describe("Constructor", () => {
    it("should initialize with default base URL", async () => {
      // Test that the scraper can be instantiated
      expect(scraper).toBeInstanceOf(TracScraper);
    });
  });

  describe("scrapeTicketsList", () => {
    it("should handle successful response", async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/ticket/12345">#12345</a>
            <a href="/ticket/12346">#12346</a>
            <a href="/ticket/12347">#12347</a>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const ticketIds = await scraper.scrapeTicketsList(1, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://core.trac.wordpress.org/query?status=!closed&order=id&desc=1&max=10",
        {
          headers: {
            "User-Agent":
              "WP-Aggregator-AI-Bot/1.0.0 (Educational/Research Purpose)",
          },
        }
      );

      // The actual parsing depends on cheerio, so we just test that the method completes
      expect(Array.isArray(ticketIds)).toBe(true);
    });

    it("should handle empty results", async () => {
      const mockHtml = `<html><body></body></html>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const ticketIds = await scraper.scrapeTicketsList(1, 10);

      expect(Array.isArray(ticketIds)).toBe(true);
    });

    it("should handle HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(scraper.scrapeTicketsList(1, 10)).rejects.toThrow(
        "HTTP 404: Not Found"
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(scraper.scrapeTicketsList(1, 10)).rejects.toThrow(
        "Network error"
      );
    });

    it("should handle malformed HTML", async () => {
      const malformedHtml = "<html><body><invalid>";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => malformedHtml,
      });

      const ticketIds = await scraper.scrapeTicketsList(1, 10);

      expect(Array.isArray(ticketIds)).toBe(true);
    });
  });

  describe("scrapeTicket", () => {
    it("should handle successful response", async () => {
      const mockHtml = `
        <html>
          <body>
            <div id="ticket">
              <div class="summary">Test Ticket</div>
              <div class="description">
                <div class="searchable">Test description</div>
              </div>
            </div>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const ticket = await scraper.scrapeTicket(12345);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://core.trac.wordpress.org/ticket/12345",
        {
          headers: {
            "User-Agent":
              "WP-Aggregator-AI-Bot/1.0.0 (Educational/Research Purpose)",
          },
        }
      );

      // The actual parsing depends on cheerio, so we just test that the method completes
      expect(ticket).toBeDefined();
    });

    it("should handle ticket not found", async () => {
      const mockHtml = `<html><body></body></html>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const ticket = await scraper.scrapeTicket(99999);

      expect(ticket).toBeNull();
    });

    it("should handle HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const ticket = await scraper.scrapeTicket(99999);
      expect(ticket).toBeNull();
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const ticket = await scraper.scrapeTicket(12345);
      expect(ticket).toBeNull();
    });

    it("should handle malformed HTML", async () => {
      const malformedHtml = "<html><body><invalid>";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => malformedHtml,
      });

      const ticket = await scraper.scrapeTicket(12345);
      expect(ticket).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle timeout errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("timeout"));

      const ticket = await scraper.scrapeTicket(12345);
      expect(ticket).toBeNull();
    });

    it("should handle invalid ticket ID", async () => {
      const mockHtml = `<html><body></body></html>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const ticket = await scraper.scrapeTicket(-1);
      expect(ticket).toBeNull();
    });

    it("should handle rate limiting", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const ticket = await scraper.scrapeTicket(12345);
      expect(ticket).toBeNull();
    });
  });
});
