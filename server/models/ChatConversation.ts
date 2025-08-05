import mongoose from "mongoose";

export interface IChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  ticketsReferenced?: number[];
  toolsUsed?: string[];
}

export interface IChatConversation {
  conversationId: string;
  title: string;
  ticketNumbers: number[];
  topics: string[];
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  messageCount: number;
  isArchived: boolean;
}

const ChatMessageSchema = new mongoose.Schema<IChatMessage>({
  role: {
    type: String,
    required: true,
    enum: ["user", "assistant"],
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  ticketsReferenced: {
    type: [Number],
    default: [],
    index: true,
  },
  toolsUsed: {
    type: [String],
    default: [],
  },
});

const ChatConversationSchema = new mongoose.Schema<IChatConversation>(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: false, // Make optional - will be auto-generated
      text: true, // Enable text search
    },
    ticketNumbers: {
      type: [Number],
      default: [],
      index: true,
    },
    topics: {
      type: [String],
      default: [],
      index: true,
    },
    messages: [ChatMessageSchema],
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastActivity: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    messageCount: {
      type: Number,
      required: true,
      default: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
ChatConversationSchema.index({ lastActivity: -1 });
ChatConversationSchema.index({ ticketNumbers: 1, lastActivity: -1 });
ChatConversationSchema.index({ topics: 1, lastActivity: -1 });
ChatConversationSchema.index({ isArchived: 1, lastActivity: -1 });

// Methods for title generation
ChatConversationSchema.methods.generateTitle = function (): string {
  const conversation = this as IChatConversation;

  // Priority 1: If ticket numbers are present
  if (conversation.ticketNumbers.length > 0) {
    if (conversation.ticketNumbers.length === 1) {
      return `Discussion: Ticket #${conversation.ticketNumbers[0]}`;
    } else if (conversation.ticketNumbers.length <= 3) {
      return `Discussion: Tickets #${conversation.ticketNumbers.join(", #")}`;
    } else {
      return `Discussion: ${conversation.ticketNumbers.length} WordPress Tickets`;
    }
  }

  // Priority 2: If topics are identified
  if (conversation.topics.length > 0) {
    const primaryTopic = conversation.topics[0];
    return `WordPress Discussion: ${primaryTopic}`;
  }

  // Priority 3: Extract from first user message
  if (conversation.messages.length > 0) {
    const firstUserMessage = conversation.messages.find(
      (m) => m.role === "user"
    );
    if (firstUserMessage) {
      // Extract first 50 characters as title
      const content = firstUserMessage.content.trim();
      if (content.length > 50) {
        return content.substring(0, 47) + "...";
      }
      return content;
    }
  }

  // Fallback: Date-based title
  const date = conversation.createdAt.toLocaleDateString();
  return `Chat Session - ${date}`;
};

// Method to extract ticket numbers from message content
ChatConversationSchema.methods.extractTicketNumbers = function (
  content: string
): number[] {
  const ticketPattern = /(?:ticket\s*#?|#)(\d{4,6})/gi;
  const matches = content.matchAll(ticketPattern);
  const tickets = new Set<number>();

  for (const match of matches) {
    const ticketNum = parseInt(match[1]);
    if (ticketNum >= 1000 && ticketNum <= 999999) {
      // Reasonable ticket number range
      tickets.add(ticketNum);
    }
  }

  return Array.from(tickets).sort((a, b) => a - b);
};

// Method to extract topics from conversation
ChatConversationSchema.methods.extractTopics = function (): string[] {
  const conversation = this as IChatConversation;
  const topics = new Set<string>();

  // WordPress-specific topic patterns
  const topicPatterns = [
    /\b(wordpress|wp)\b/i,
    /\b(development|dev|developing)\b/i,
    /\b(blocks?|gutenberg|block editor)\b/i,
    /\b(hooks?|filters?|actions?)\b/i,
    /\b(themes?|template|styling)\b/i,
    /\b(plugins?|plugin development)\b/i,
    /\b(multisite|network)\b/i,
    /\b(rest\s*api|api|endpoints?)\b/i,
    /\b(database|sql|queries?)\b/i,
    /\b(security|authentication|permissions?)\b/i,
    /\b(performance|caching|optimization)\b/i,
    /\b(media|images?|uploads?)\b/i,
    /\b(customizer|widgets?)\b/i,
    /\b(shortcodes?)\b/i,
    /\b(ajax|javascript|js)\b/i,
    /\b(php|functions?)\b/i,
    /\b(testing|unit tests?|phpunit)\b/i,
  ];

  const allContent = conversation.messages
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  for (const pattern of topicPatterns) {
    const match = allContent.match(pattern);
    if (match) {
      // Normalize topic names
      let topic = match[0].toLowerCase();
      if (topic.includes("wordpress") || topic.includes("wp"))
        topic = "WordPress";
      else if (topic.includes("development") || topic.includes("dev"))
        topic = "Development";
      else if (topic.includes("block")) topic = "Blocks";
      else if (
        topic.includes("hook") ||
        topic.includes("filter") ||
        topic.includes("action")
      )
        topic = "Hooks & Filters";
      else if (topic.includes("theme")) topic = "Themes";
      else if (topic.includes("plugin")) topic = "Plugins";
      else if (topic.includes("multisite")) topic = "Multisite";
      else if (topic.includes("api")) topic = "REST API";
      else if (topic.includes("database") || topic.includes("sql"))
        topic = "Database";
      else if (topic.includes("security") || topic.includes("auth"))
        topic = "Security";
      else if (topic.includes("performance") || topic.includes("caching"))
        topic = "Performance";
      else if (topic.includes("media") || topic.includes("image"))
        topic = "Media";
      else if (topic.includes("customizer") || topic.includes("widget"))
        topic = "Customization";
      else if (topic.includes("shortcode")) topic = "Shortcodes";
      else if (topic.includes("ajax") || topic.includes("javascript"))
        topic = "JavaScript";
      else if (topic.includes("php") || topic.includes("function"))
        topic = "PHP Development";
      else if (topic.includes("test")) topic = "Testing";

      topics.add(topic);
    }
  }

  return Array.from(topics);
};

// Pre-save middleware to update computed fields
ChatConversationSchema.pre("save", function (next) {
  const conversation = this as IChatConversation;

  // Update message count
  conversation.messageCount = conversation.messages.length;

  // Update last activity
  if (conversation.messages.length > 0) {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    conversation.lastActivity = lastMessage.timestamp;
  }

  // Extract and update ticket numbers from all messages
  const allTickets = new Set<number>();
  for (const message of conversation.messages) {
    const tickets = this.extractTicketNumbers(message.content);
    tickets.forEach((t) => allTickets.add(t));
    message.ticketsReferenced = tickets;
  }
  conversation.ticketNumbers = Array.from(allTickets).sort((a, b) => a - b);

  // Extract and update topics
  conversation.topics = this.extractTopics();

  // Auto-generate title if not set or if it's a default title
  if (!conversation.title || conversation.title.startsWith("Chat Session -")) {
    try {
      const generatedTitle = this.generateTitle();
      conversation.title =
        generatedTitle ||
        `Chat Session - ${conversation.createdAt.toLocaleDateString()}`;
    } catch (error) {
      // Fallback if generateTitle fails
      conversation.title = `Chat Session - ${conversation.createdAt.toLocaleDateString()}`;
    }
  }

  next();
});

export const ChatConversation = mongoose.model<IChatConversation>(
  "ChatConversation",
  ChatConversationSchema
);
export default ChatConversation;
