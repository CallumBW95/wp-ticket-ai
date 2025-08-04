import mongoose from "mongoose";

export interface IAttachment {
  filename: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  description?: string;
  url: string;
}

export interface IComment {
  id: number;
  author: string;
  timestamp: Date;
  content: string;
  changes?: {
    field: string;
    oldValue?: string;
    newValue?: string;
  }[];
}

export interface IChangeset {
  revision: number;
  author: string;
  timestamp: Date;
  message: string;
  files: string[];
  url: string;
}

export interface ITicket {
  ticketId: number;
  url: string;
  title: string;
  description: string;
  type: "defect" | "enhancement" | "feature request" | "task";
  status: "new" | "assigned" | "accepted" | "reviewing" | "testing" | "closed";
  priority: "trivial" | "minor" | "normal" | "major" | "critical" | "blocker";
  severity?: "trivial" | "minor" | "normal" | "major" | "critical";
  component: string;
  version?: string;
  milestone?: string;
  owner?: string;
  reporter: string;
  keywords: string[];
  focuses: string[];
  createdAt: Date;
  updatedAt: Date;
  resolution?: string;
  resolutionDate?: Date;
  comments: IComment[];
  attachments: IAttachment[];
  relatedChangesets: IChangeset[];
  ccList: string[];
  blockedBy: number[];
  blocking: number[];
}

const AttachmentSchema = new mongoose.Schema<IAttachment>({
  filename: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, required: true },
  description: String,
  url: { type: String, required: true },
});

const CommentSchema = new mongoose.Schema<IComment>({
  id: { type: Number, required: true },
  author: { type: String, required: true },
  timestamp: { type: Date, required: true },
  content: { type: String, required: true },
  changes: [
    {
      field: { type: String, required: true },
      oldValue: String,
      newValue: String,
    },
  ],
});

const ChangesetSchema = new mongoose.Schema<IChangeset>({
  revision: { type: Number, required: true },
  author: { type: String, required: true },
  timestamp: { type: Date, required: true },
  message: { type: String, required: true },
  files: [String],
  url: { type: String, required: true },
});

const TicketSchema = new mongoose.Schema<ITicket>(
  {
    ticketId: { type: Number, required: true, unique: true, index: true },
    url: { type: String, required: true },
    title: { type: String, required: true, text: true },
    description: { type: String, required: true, text: true },
    type: {
      type: String,
      required: true,
      enum: ["defect", "enhancement", "feature request", "task"],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["new", "assigned", "accepted", "reviewing", "testing", "closed"],
      index: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ["trivial", "minor", "normal", "major", "critical", "blocker"],
      index: true,
    },
    severity: {
      type: String,
      enum: ["trivial", "minor", "normal", "major", "critical"],
    },
    component: { type: String, required: true, index: true },
    version: String,
    milestone: { type: String, index: true },
    owner: String,
    reporter: { type: String, required: true },
    keywords: { type: [String], index: true },
    focuses: { type: [String], index: true },
    createdAt: { type: Date, required: true, index: true },
    updatedAt: { type: Date, required: true, index: true },
    resolution: String,
    resolutionDate: Date,
    comments: [CommentSchema],
    attachments: [AttachmentSchema],
    relatedChangesets: [ChangesetSchema],
    ccList: [String],
    blockedBy: [Number],
    blocking: [Number],
  },
  {
    timestamps: false, // We handle timestamps manually
  }
);

// Create text index for full-text search
TicketSchema.index({
  title: "text",
  description: "text",
  "comments.content": "text",
});

// Create compound indexes for common queries
TicketSchema.index({ status: 1, priority: 1 });
TicketSchema.index({ component: 1, status: 1 });
TicketSchema.index({ milestone: 1, status: 1 });
TicketSchema.index({ updatedAt: -1 });
TicketSchema.index({ createdAt: -1 });

export const Ticket = mongoose.model<ITicket>("Ticket", TicketSchema);
