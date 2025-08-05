// Test correct path resolution for scraper
import path from "path";
import { fileURLToPath } from "url";

// Simulate being in server/scraper/index.ts
const simulatedScraperPath =
  "/Users/callum.bridgford-whittick/code/personal-projects/wp-aggregator-ai/server/scraper/index.ts";
const scraperDir = path.dirname(simulatedScraperPath);

console.log("Scraper file:", simulatedScraperPath);
console.log("Scraper dir:", scraperDir);
console.log("One level up (../):", path.resolve(scraperDir, ".."));
console.log("Two levels up (../../):", path.resolve(scraperDir, "../.."));

// We want: /Users/callum.bridgford-whittick/code/personal-projects/wp-aggregator-ai
// From:    /Users/callum.bridgford-whittick/code/personal-projects/wp-aggregator-ai/server/scraper
// Need:    ../../ (up two levels)

const projectRoot = path.resolve(scraperDir, "../..");
console.log("Project root should be:", projectRoot);
console.log("Env file path:", path.join(projectRoot, ".env"));
