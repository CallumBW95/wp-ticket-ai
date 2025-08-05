import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, ".");
const envPath = path.join(projectRoot, ".env");

console.log("Current directory:", process.cwd());
console.log("Script directory:", __dirname);
console.log("Project root:", projectRoot);
console.log("Env file path:", envPath);
console.log("Env file exists:", fs.existsSync(envPath));

const result = dotenv.config({ path: envPath });
console.log("Dotenv result:", result.error ? result.error.message : "Success");
console.log("MONGODB_URI loaded:", !!process.env.MONGODB_URI);
console.log(
  "MONGODB_URI starts with:",
  process.env.MONGODB_URI?.substring(0, 30)
);
