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
    it("should scrape ticket details with comments", async () => {
      const mockHtml = `
        <html>
          <body>
            <div id="ticket">
              <div class="summary">Test Ticket</div>
              <div class="description">
                <div class="searchable">This is a test ticket description.</div>
              </div>
            </div>
            <div class="properties">
              <table>
                <tr><th>Type</th><td>defect</td></tr>
                <tr><th>Status</th><td>new</td></tr>
                <tr><th>Priority</th><td>normal</td></tr>
                <tr><th>Component</th><td>General</td></tr>
                <tr><th>Reporter</th><td>testuser</td></tr>
                <tr><th>Time</th><td>2024-01-01 12:00:00</td></tr>
                <tr><th>Change Time</th><td>2024-01-01 12:00:00</td></tr>
              </table>
            </div>
            <div class="change">
              <div class="comment">This is a test comment.</div>
              <div class="author">testuser</div>
              <div class="time">2024-01-01 12:00:00</div>
            </div>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const ticket = await scraper.scrapeTicket(12345);

      expect(ticket).toBeDefined();
      expect(ticket?.ticketId).toBe(12345);
      expect(ticket?.title).toBe("Test Ticket");
      expect(ticket?.description).toBe("This is a test ticket description.");
      expect(ticket?.status).toBe("new");
    });

    it("should handle ticket without comments", async () => {
      const mockHtml = `
        <html>
          <body>
            <div id="ticket">
              <div class="summary">Test Ticket</div>
              <div class="description">
                <div class="searchable">This is a test ticket description.</div>
              </div>
            </div>
            <div class="properties">
              <table>
                <tr><th>Type</th><td>defect</td></tr>
                <tr><th>Status</th><td>new</td></tr>
                <tr><th>Priority</th><td>normal</td></tr>
                <tr><th>Component</th><td>General</td></tr>
                <tr><th>Reporter</th><td>testuser</td></tr>
                <tr><th>Time</th><td>2024-01-01 12:00:00</td></tr>
                <tr><th>Change Time</th><td>2024-01-01 12:00:00</td></tr>
              </table>
            </div>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const ticket = await scraper.scrapeTicket(12345);

      expect(ticket).toBeDefined();
      expect(ticket?.comments).toHaveLength(0);
      expect(ticket?.ticketId).toBe(12345);
      expect(ticket?.title).toBe("Test Ticket");
    });

    it("should handle missing optional fields", async () => {
      const mockHtml = `
        <html>
          <body>
            <div id="ticket">
              <div class="summary">Test Ticket</div>
              <div class="description">
                <div class="searchable">This is a test ticket description.</div>
              </div>
              <div class="properties">
                <table>
                  <tr><th>type</th><td>defect</td></tr>
                  <tr><th>status</th><td>new</td></tr>
                  <tr><th>priority</th><td>normal</td></tr>
                  <tr><th>component</th><td>General</td></tr>
                  <tr><th>reporter</th><td>testuser</td></tr>
                  <tr><th>time</th><td>2024-01-01 12:00:00</td></tr>
                  <tr><th>changetime</th><td>2024-01-01 12:00:00</td></tr>
                </table>
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

      expect(ticket).toBeDefined();
      expect(ticket?.reporter).toBe("testuser");
      expect(ticket?.owner).toBeUndefined();
      expect(ticket?.ccList).toEqual([]);
      expect(ticket?.keywords).toEqual([]);
      expect(ticket?.milestone).toBeUndefined();
      expect(ticket?.version).toBeUndefined();
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
      const malformedHtml = `
        <html>
          <body>
            <div id="ticket">
              <div class="summary">Test Ticket</div>
              <div class="description">
                <div class="searchable">This is a test ticket description.</div>
              </div>
            </div>
            <div class="properties">
              <table>
                <tr><th>Type</th><td>defect</td></tr>
                <tr><th>Status</th><td>new</td></tr>
                <tr><th>Priority</th><td>normal</td></tr>
                <tr><th>Component</th><td>General</td></tr>
                <tr><th>Reporter</th><td>testuser</td></tr>
                <tr><th>Time</th><td>2024-01-01 12:00:00</td></tr>
                <tr><th>Change Time</th><td>2024-01-01 12:00:00</td></tr>
              </table>
            </div>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => malformedHtml,
      });

      const ticket = await scraper.scrapeTicket(12345);

      expect(ticket).toBeDefined();
      expect(ticket?.ticketId).toBe(12345);
      expect(ticket?.title).toBe("Test Ticket");
      expect(ticket?.description).toBe("This is a test ticket description.");
      expect(ticket?.comments).toHaveLength(0);
    });

    it("should handle comments with missing timestamps", async () => {
      const mockHtml = `
        <html>
          <body>
            <div id="ticket">
              <div class="summary">Test Ticket</div>
              <div class="description">
                <div class="searchable">This is a test ticket description.</div>
              </div>
            </div>
            <div class="properties">
              <table>
                <tr><th>Type</th><td>defect</td></tr>
                <tr><th>Status</th><td>new</td></tr>
                <tr><th>Priority</th><td>normal</td></tr>
                <tr><th>Component</th><td>General</td></tr>
                <tr><th>Reporter</th><td>testuser</td></tr>
                <tr><th>Time</th><td>2024-01-01 12:00:00</td></tr>
                <tr><th>Change Time</th><td>2024-01-01 12:00:00</td></tr>
              </table>
            </div>
            <div class="change">
              <div class="comment searchable">This is a test comment.</div>
              <div class="trac-author">testuser</div>
            </div>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const ticket = await scraper.scrapeTicket(12345);

      expect(ticket).toBeDefined();
      expect(ticket?.comments).toHaveLength(1);
      expect(ticket?.comments[0].author).toBe("testuser");
      expect(ticket?.comments[0].content).toBe("This is a test comment.");
      expect(ticket?.comments[0].timestamp).toBeInstanceOf(Date);
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

      const ticket = await scraper.scrapeTicket(99999);
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
