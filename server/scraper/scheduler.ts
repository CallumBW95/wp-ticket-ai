import * as cron from "node-cron";
import TracScraper from "./TracScraper.js";

export function startScrapingScheduler(): void {
  console.log("🕐 Starting WordPress Trac scraping scheduler...");

  const scraper = new TracScraper();

  // Schedule recent tickets scraping every 2 hours
  cron.schedule("0 */2 * * *", async () => {
    console.log("⏰ Starting scheduled recent tickets scraping...");
    try {
      const ticketIds = await scraper.scrapeTicketsList(1, 20); // Get 20 most recent

      for (const ticketId of ticketIds) {
        const ticketData = await scraper.scrapeTicket(ticketId);
        if (ticketData) {
          await scraper.saveTicket(ticketData);
        }
      }

      console.log(
        `✅ Scheduled scraping completed: ${ticketIds.length} tickets processed`
      );
    } catch (error) {
      console.error("❌ Scheduled scraping failed:", error);
    }
  });

  // Schedule bulk update once daily at 2 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("⏰ Starting scheduled bulk update...");
    try {
      const ticketIds = await scraper.scrapeTicketsList(1, 100); // Get more tickets for daily update

      for (const ticketId of ticketIds) {
        const ticketData = await scraper.scrapeTicket(ticketId);
        if (ticketData) {
          await scraper.saveTicket(ticketData);
        }
      }

      console.log(
        `✅ Daily bulk update completed: ${ticketIds.length} tickets processed`
      );
    } catch (error) {
      console.error("❌ Daily bulk update failed:", error);
    }
  });

  console.log("✅ Scraping scheduler configured:");
  console.log("   - Recent tickets: every 2 hours");
  console.log("   - Bulk update: daily at 2 AM");
}
