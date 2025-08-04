import * as cheerio from "cheerio";
import {
  Ticket,
  ITicket,
  IComment,
  IAttachment,
  IChangeset,
} from "../models/Ticket.js";

export class TracScraper {
  private baseUrl = "https://core.trac.wordpress.org";
  private requestDelay = 1000; // 1 second between requests to be respectful

  private async fetchWithDelay(url: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, this.requestDelay));

    try {
      console.log(`Fetching: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "WP-Aggregator-AI-Bot/1.0.0 (Educational/Research Purpose)",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  async scrapeTicketsList(page = 1, maxResults = 100): Promise<number[]> {
    const url = `${this.baseUrl}/report/40?asc=1&sort=id&page=${page}&max=${maxResults}`;
    const html = await this.fetchWithDelay(url);
    const $ = cheerio.load(html);

    const ticketIds: number[] = [];

    // Parse ticket list from the report page
    $(".listing.tickets tbody tr").each((_, element) => {
      const ticketLink = $(element).find("td.id a").attr("href");
      if (ticketLink) {
        const match = ticketLink.match(/\/ticket\/(\d+)/);
        if (match) {
          ticketIds.push(parseInt(match[1]));
        }
      }
    });

    console.log(`Found ${ticketIds.length} tickets on page ${page}`);
    return ticketIds;
  }

  async scrapeTicket(ticketId: number): Promise<ITicket | null> {
    try {
      const url = `${this.baseUrl}/ticket/${ticketId}`;
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);

      // Extract basic ticket information
      const title = $("#ticket .summary").text().trim();
      if (!title) {
        console.log(`Ticket ${ticketId} not found or inaccessible`);
        return null;
      }

      const description = $("#ticket .description .searchable").text().trim();

      // Extract ticket properties
      const properties = this.extractTicketProperties($);

      // Extract comments
      const comments = this.extractComments($);

      // Extract attachments
      const attachments = this.extractAttachments($);

      // Extract related changesets
      const changesets = this.extractChangesets($);

      const ticket: ITicket = {
        ticketId,
        url,
        title,
        description,
        type: this.normalizeType(properties.type),
        status: this.normalizeStatus(properties.status),
        priority: this.normalizePriority(properties.priority),
        severity: properties.severity
          ? this.normalizeSeverity(properties.severity)
          : undefined,
        component: properties.component || "Unknown",
        version: properties.version,
        milestone: properties.milestone,
        owner: properties.owner,
        reporter: properties.reporter || "Unknown",
        keywords: properties.keywords
          ? properties.keywords.split(/[\s,]+/).filter((k) => k)
          : [],
        focuses: properties.focuses
          ? properties.focuses.split(/[\s,]+/).filter((f) => f)
          : [],
        createdAt: this.parseDate(properties.time) || new Date(),
        updatedAt: this.parseDate(properties.changetime) || new Date(),
        resolution: properties.resolution,
        resolutionDate: properties.resolution
          ? this.parseDate(properties.changetime)
          : undefined,
        comments,
        attachments,
        relatedChangesets: changesets,
        ccList: properties.cc
          ? properties.cc.split(/[\s,]+/).filter((cc) => cc)
          : [],
        blockedBy: [],
        blocking: [],
      };

      return ticket;
    } catch (error) {
      console.error(`Error scraping ticket ${ticketId}:`, error);
      return null;
    }
  }

  private extractTicketProperties(
    $: cheerio.CheerioAPI
  ): Record<string, string> {
    const properties: Record<string, string> = {};

    $("#ticket .properties table tr").each((_, row) => {
      const $row = $(row);
      const header = $row.find("th").text().trim().toLowerCase();
      const value = $row.find("td").text().trim();

      if (header && value) {
        properties[header] = value;
      }
    });

    return properties;
  }

  private extractComments($: cheerio.CheerioAPI): IComment[] {
    const comments: IComment[] = [];

    $(".change").each((index, element) => {
      const $change = $(element);
      const commentId = index + 1;

      const author = $change.find(".author").text().trim() || "Unknown";
      const timestamp =
        this.parseDate($change.find(".date").attr("title") || "") || new Date();
      const content = $change.find(".comment .searchable").text().trim();

      // Extract property changes
      const changes: any[] = [];
      $change.find(".changes ul li").each((_, changeElement) => {
        const changeText = $(changeElement).text().trim();
        const match = changeText.match(
          /(.+?)\s+changed from\s+(.+?)\s+to\s+(.+)/
        );
        if (match) {
          changes.push({
            field: match[1].trim(),
            oldValue: match[2].trim(),
            newValue: match[3].trim(),
          });
        }
      });

      if (content || changes.length > 0) {
        comments.push({
          id: commentId,
          author,
          timestamp,
          content,
          changes: changes.length > 0 ? changes : undefined,
        });
      }
    });

    return comments;
  }

  private extractAttachments($: cheerio.CheerioAPI): IAttachment[] {
    const attachments: IAttachment[] = [];

    $("#attachments .attachment").each((_, element) => {
      const $attachment = $(element);
      const filename = $attachment.find(".trac-field-attachment").text().trim();
      const sizeText = $attachment.find(".trac-field-size").text().trim();
      const size = this.parseSize(sizeText);
      const uploadedBy = $attachment.find(".trac-field-author").text().trim();
      const uploadedAtText = $attachment.find(".trac-field-time").text().trim();
      const uploadedAt = this.parseDate(uploadedAtText) || new Date();
      const description = $attachment
        .find(".trac-field-description")
        .text()
        .trim();
      const url = this.baseUrl + $attachment.find("a").attr("href");

      if (filename && uploadedBy) {
        attachments.push({
          filename,
          size,
          uploadedBy,
          uploadedAt,
          description: description || undefined,
          url,
        });
      }
    });

    return attachments;
  }

  private extractChangesets($: cheerio.CheerioAPI): IChangeset[] {
    const changesets: IChangeset[] = [];

    // Look for changeset references in comments and ticket description
    const changesetPattern = /\[(\d+)\]|\br(\d+)\b|changeset:(\d+)/gi;

    $(".searchable").each((_, element) => {
      const text = $(element).text();
      let match;
      while ((match = changesetPattern.exec(text)) !== null) {
        const revision = parseInt(match[1] || match[2] || match[3]);
        if (revision && !changesets.find((cs) => cs.revision === revision)) {
          changesets.push({
            revision,
            author: "Unknown",
            timestamp: new Date(),
            message: `Referenced in ticket`,
            files: [],
            url: `${this.baseUrl}/changeset/${revision}`,
          });
        }
      }
    });

    return changesets;
  }

  private normalizeType(type: string): ITicket["type"] {
    const normalized = type?.toLowerCase();
    switch (normalized) {
      case "defect":
      case "bug":
        return "defect";
      case "enhancement":
        return "enhancement";
      case "feature request":
        return "feature request";
      case "task":
        return "task";
      default:
        return "defect";
    }
  }

  private normalizeStatus(status: string): ITicket["status"] {
    const normalized = status?.toLowerCase();
    switch (normalized) {
      case "new":
        return "new";
      case "assigned":
        return "assigned";
      case "accepted":
        return "accepted";
      case "reviewing":
        return "reviewing";
      case "testing":
        return "testing";
      case "closed":
        return "closed";
      default:
        return "new";
    }
  }

  private normalizePriority(priority: string): ITicket["priority"] {
    const normalized = priority?.toLowerCase();
    switch (normalized) {
      case "trivial":
        return "trivial";
      case "minor":
        return "minor";
      case "normal":
        return "normal";
      case "major":
        return "major";
      case "critical":
        return "critical";
      case "blocker":
        return "blocker";
      default:
        return "normal";
    }
  }

  private normalizeSeverity(severity: string): ITicket["severity"] {
    const normalized = severity?.toLowerCase();
    switch (normalized) {
      case "trivial":
        return "trivial";
      case "minor":
        return "minor";
      case "normal":
        return "normal";
      case "major":
        return "major";
      case "critical":
        return "critical";
      default:
        return "normal";
    }
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Try parsing various date formats used by Trac
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  private parseSize(sizeStr: string): number {
    if (!sizeStr) return 0;

    const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*(bytes|KB|MB|GB)?/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2]?.toLowerCase();

    switch (unit) {
      case "kb":
        return value * 1024;
      case "mb":
        return value * 1024 * 1024;
      case "gb":
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  async saveTicket(ticketData: ITicket): Promise<void> {
    try {
      await Ticket.findOneAndUpdate(
        { ticketId: ticketData.ticketId },
        ticketData,
        { upsert: true, new: true }
      );
      console.log(
        `✅ Saved ticket ${ticketData.ticketId}: ${ticketData.title}`
      );
    } catch (error) {
      console.error(`❌ Failed to save ticket ${ticketData.ticketId}:`, error);
    }
  }
}

export default TracScraper;
