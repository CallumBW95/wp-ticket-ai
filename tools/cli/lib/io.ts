import Table from "cli-table3";
import chalk from "chalk";

export type LogLevel = "quiet" | "normal" | "verbose";
let level: LogLevel = "normal";

export const setLogLevel = (l: LogLevel) => {
  level = l;
};

export const logger = {
  info: (msg: string) => {
    if (level === "quiet") return;
    console.log(msg);
  },
  verbose: (msg: string) => {
    if (level !== "verbose") return;
    console.log(chalk.dim(msg));
  },
  error: (msg: string) => {
    console.error(chalk.red(msg));
  },
};

export async function printJsonOrTable(
  data: any,
  asJson: boolean,
  opts?: { columns?: string[] }
) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // If data is array and columns provided, render a table
  if (Array.isArray(data) && opts?.columns && data.length > 0) {
    const table = new Table({ head: opts.columns });
    for (const row of data) {
      table.push(opts.columns.map((c) => safeCell(row?.[c])));
    }
    console.log(table.toString());
    return;
  }

  // Fallback pretty print
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

function safeCell(v: unknown) {
  if (v == null) return "";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 117) + "..." : v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}