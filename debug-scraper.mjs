// Test the exact same environment loading as the scraper
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const envPath = path.join(projectRoot, ".env");

console.log("Scraper-style loading:");
console.log("Project root:", projectRoot);
console.log("Env path:", envPath);

dotenv.config({ path: envPath });
console.log("MONGODB_URI from scraper perspective:", !!process.env.MONGODB_URI);

// Test the database check
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.log("❌ MONGODB_URI environment variable is required");
} else {
  console.log("✅ MONGODB_URI found:", MONGODB_URI.substring(0, 30));
}
