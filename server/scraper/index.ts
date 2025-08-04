import { connectToDatabase } from "../config/database.js";
import TracScraper from "./TracScraper.js";

async function runScraper() {
  try {
    // Connect to database
    await connectToDatabase();

    const scraper = new TracScraper();

    // Get command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case "recent":
        await scrapeRecentTickets(scraper, parseInt(args[1]) || 50);
        break;
      case "ticket":
        const ticketId = parseInt(args[1]);
        if (ticketId) {
          await scrapeSingleTicket(scraper, ticketId);
        } else {
          console.error(
            "Please provide a ticket ID: npm run scrape ticket 12345"
          );
        }
        break;
      case "bulk":
        await scrapeBulkTickets(scraper, parseInt(args[1]) || 100);
        break;
      default:
        console.log("WordPress Trac Scraper");
        console.log("Usage:");
        console.log(
          "  npm run scrape recent [count]     - Scrape recent tickets"
        );
        console.log(
          "  npm run scrape ticket <id>        - Scrape specific ticket"
        );
        console.log(
          "  npm run scrape bulk [count]       - Scrape tickets in bulk"
        );
        break;
    }
  } catch (error) {
    console.error("Scraper error:", error);
  } finally {
    process.exit(0);
  }
}

async function scrapeRecentTickets(scraper: TracScraper, count: number) {
  console.log(`🔍 Scraping ${count} recent tickets...`);

  const ticketIds = await scraper.scrapeTicketsList(1, count);

  for (let i = 0; i < ticketIds.length; i++) {
    const ticketId = ticketIds[i];
    console.log(`[${i + 1}/${ticketIds.length}] Processing ticket ${ticketId}`);

    const ticketData = await scraper.scrapeTicket(ticketId);
    if (ticketData) {
      await scraper.saveTicket(ticketData);
    }
  }

  console.log(`✅ Completed scraping ${ticketIds.length} tickets`);
}

async function scrapeSingleTicket(scraper: TracScraper, ticketId: number) {
  console.log(`🔍 Scraping ticket ${ticketId}...`);

  const ticketData = await scraper.scrapeTicket(ticketId);
  if (ticketData) {
    await scraper.saveTicket(ticketData);
    console.log(`✅ Successfully scraped ticket ${ticketId}`);
  } else {
    console.log(`❌ Failed to scrape ticket ${ticketId}`);
  }
}

async function scrapeBulkTickets(scraper: TracScraper, maxTickets: number) {
  console.log(`🔍 Starting bulk scraping of up to ${maxTickets} tickets...`);

  let totalScraped = 0;
  let page = 1;
  const ticketsPerPage = 100;

  while (totalScraped < maxTickets) {
    console.log(`\n📄 Processing page ${page}...`);

    const remaining = maxTickets - totalScraped;
    const pageSize = Math.min(ticketsPerPage, remaining);

    const ticketIds = await scraper.scrapeTicketsList(page, pageSize);

    if (ticketIds.length === 0) {
      console.log("No more tickets found");
      break;
    }

    for (let i = 0; i < ticketIds.length; i++) {
      const ticketId = ticketIds[i];
      console.log(
        `[${totalScraped + i + 1}/${maxTickets}] Processing ticket ${ticketId}`
      );

      const ticketData = await scraper.scrapeTicket(ticketId);
      if (ticketData) {
        await scraper.saveTicket(ticketData);
      }
    }

    totalScraped += ticketIds.length;
    page++;

    // Break if we got fewer tickets than requested (likely last page)
    if (ticketIds.length < pageSize) {
      break;
    }
  }

  console.log(
    `✅ Bulk scraping completed. Total tickets processed: ${totalScraped}`
  );
}

runScraper();
