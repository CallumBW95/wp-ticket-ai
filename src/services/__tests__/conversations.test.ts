import {
  extractTicketNumbers,
  formatConversationTitle,
  formatRelativeTime,
} from "../conversations.js";
import { ConversationSummary } from "../conversations.js";

describe("Conversations Service", () => {
  describe("extractTicketNumbers", () => {
    it("should extract ticket numbers from various formats", () => {
      const testCases = [
        {
          input: "I need help with ticket #12345",
          expected: [12345],
        },
        {
          input: "Check tickets #12345 and #67890",
          expected: [12345, 67890],
        },
        {
          input: "ticket 11111 and ticket #22222",
          expected: [11111, 22222],
        },
        {
          input: "Ticket #54321, #98765, and #13579",
          expected: [13579, 54321, 98765], // Should be sorted
        },
        {
          input: "#123 is too short, #1234567 is too long",
          expected: [], // Outside valid range
        },
        {
          input: "No tickets in this message",
          expected: [],
        },
        {
          input: "Valid tickets: #1234, #5678, #1234", // Duplicates
          expected: [1234, 5678], // Should remove duplicates
        },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(extractTicketNumbers(input)).toEqual(expected);
      });
    });

    it("should handle edge cases", () => {
      expect(extractTicketNumbers("")).toEqual([]);
      expect(extractTicketNumbers("###")).toEqual([]);
      expect(extractTicketNumbers("ticket ticket")).toEqual([]);
      expect(extractTicketNumbers("#abc123")).toEqual([]);
    });
  });

  describe("formatConversationTitle", () => {
    it("should format title for single ticket", () => {
      const conversation: ConversationSummary = {
        conversationId: "test",
        title: "Auto-generated title",
        ticketNumbers: [12345],
        topics: [],
        messageCount: 1,
        lastActivity: "2023-01-01T00:00:00Z",
        createdAt: "2023-01-01T00:00:00Z",
        isArchived: false,
      };

      expect(formatConversationTitle(conversation)).toBe("Ticket #12345");
    });

    it("should format title for multiple tickets", () => {
      const conversation: ConversationSummary = {
        conversationId: "test",
        title: "Auto-generated title",
        ticketNumbers: [12345, 67890],
        topics: [],
        messageCount: 1,
        lastActivity: "2023-01-01T00:00:00Z",
        createdAt: "2023-01-01T00:00:00Z",
        isArchived: false,
      };

      expect(formatConversationTitle(conversation)).toBe(
        "Tickets #12345, #67890"
      );
    });

    it("should format title for many tickets", () => {
      const conversation: ConversationSummary = {
        conversationId: "test",
        title: "Auto-generated title",
        ticketNumbers: [1, 2, 3, 4, 5],
        topics: [],
        messageCount: 1,
        lastActivity: "2023-01-01T00:00:00Z",
        createdAt: "2023-01-01T00:00:00Z",
        isArchived: false,
      };

      expect(formatConversationTitle(conversation)).toBe("5 WordPress Tickets");
    });

    it("should format title from topics when no tickets", () => {
      const conversation: ConversationSummary = {
        conversationId: "test",
        title: "Auto-generated title",
        ticketNumbers: [],
        topics: ["Blocks", "Editor"],
        messageCount: 1,
        lastActivity: "2023-01-01T00:00:00Z",
        createdAt: "2023-01-01T00:00:00Z",
        isArchived: false,
      };

      expect(formatConversationTitle(conversation)).toBe("Blocks Discussion");
    });

    it("should use existing title if meaningful", () => {
      const conversation: ConversationSummary = {
        conversationId: "test",
        title: "Custom WordPress Discussion",
        ticketNumbers: [],
        topics: [],
        messageCount: 1,
        lastActivity: "2023-01-01T00:00:00Z",
        createdAt: "2023-01-01T00:00:00Z",
        isArchived: false,
      };

      expect(formatConversationTitle(conversation)).toBe(
        "Custom WordPress Discussion"
      );
    });

    it("should fallback to date when no meaningful data", () => {
      const conversation: ConversationSummary = {
        conversationId: "test",
        title: "Chat Session - 1/1/2023",
        ticketNumbers: [],
        topics: [],
        messageCount: 1,
        lastActivity: "2023-01-01T00:00:00Z",
        createdAt: "2023-01-01T00:00:00Z",
        isArchived: false,
      };

      const result = formatConversationTitle(conversation);
      expect(result).toMatch(/Chat - \d+\/\d+\/\d+/);
    });
  });

  describe("formatRelativeTime", () => {
    const now = new Date("2023-01-15T12:00:00Z");

    beforeAll(() => {
      // Mock Date.now() to return a fixed timestamp
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should format "just now" for very recent times', () => {
      const timestamp = new Date(now.getTime() - 30 * 1000).toISOString(); // 30 seconds ago
      expect(formatRelativeTime(timestamp)).toBe("Just now");
    });

    it("should format minutes for recent times", () => {
      const timestamp = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      expect(formatRelativeTime(timestamp)).toBe("5m ago");
    });

    it("should format hours for times within a day", () => {
      const timestamp = new Date(
        now.getTime() - 3 * 60 * 60 * 1000
      ).toISOString(); // 3 hours ago
      expect(formatRelativeTime(timestamp)).toBe("3h ago");
    });

    it("should format days for times within a week", () => {
      const timestamp = new Date(
        now.getTime() - 2 * 24 * 60 * 60 * 1000
      ).toISOString(); // 2 days ago
      expect(formatRelativeTime(timestamp)).toBe("2d ago");
    });

    it("should format weeks for times within a month", () => {
      const timestamp = new Date(
        now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000
      ).toISOString(); // 2 weeks ago
      expect(formatRelativeTime(timestamp)).toBe("2w ago");
    });

    it("should format months for times within a year", () => {
      const timestamp = new Date(
        now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000
      ).toISOString(); // ~3 months ago
      expect(formatRelativeTime(timestamp)).toBe("3mo ago");
    });

    it("should format years for very old times", () => {
      const timestamp = new Date(
        now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000
      ).toISOString(); // 2 years ago
      expect(formatRelativeTime(timestamp)).toBe("2y ago");
    });

    it("should handle edge cases", () => {
      // Less than 1 minute
      const almostOneMinute = new Date(now.getTime() - 59 * 1000).toISOString();
      expect(formatRelativeTime(almostOneMinute)).toBe("Just now");

      // Exactly 1 hour
      const oneHour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(oneHour)).toBe("1h ago");

      // Exactly 1 day
      const oneDay = new Date(
        now.getTime() - 24 * 60 * 60 * 1000
      ).toISOString();
      expect(formatRelativeTime(oneDay)).toBe("1d ago");
    });
  });
});
