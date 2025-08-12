#!/usr/bin/env node
import { Command } from "commander";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pkg from "../../package.json" assert { type: "json" };
import { createApiClient } from "./lib/api";
import { printJsonOrTable, logger, setLogLevel } from "./lib/io";
import { z } from "zod";

const program = new Command();

program
  .name("wpai")
  .description("WP Aggregator AI CLI")
  .version(pkg.version)
  .option("--api <url>", "API base URL override")
  .option("--json", "output JSON", false)
  .option("--quiet", "minimal logs", false)
  .option("--verbose", "verbose logs", false)
  .option("--timeout <ms>", "request timeout (ms)", "15000");

program.hook("preAction", (thisCmd) => {
  const opts = thisCmd.opts();
  setLogLevel(opts.quiet ? "quiet" : opts.verbose ? "verbose" : "normal");
});

// ticket get <id>
program
  .command("ticket")
  .description("Ticket commands")
  .argument("<ticketId>", "Trac ticket id (number)")
  .argument("<task>", "task: get|comments")
  .action(async (ticketId, task) => {
    const opts = program.opts();
    const api = createApiClient(opts.api, Number(opts.timeout));

    const idNum = z.coerce.number().int().positive().parse(ticketId);

    if (task === "get") {
      const data = await api.get(`/api/tickets/${idNum}`);
      await printJsonOrTable(data, opts.json, {
        columns: ["ticketId", "title", "status", "priority", "component", "updatedAt"],
      });
      return;
    }
    if (task === "comments") {
      const data = await api.get(`/api/tickets/${idNum}`);
      await printJsonOrTable(data.comments ?? [], opts.json, {
        columns: ["author", "createdAt", "content"],
      });
      return;
    }
    logger.error("Unknown task for ticket. Use: get|comments");
    process.exit(2);
  });

// conv list
program
  .command("conv")
  .description("Conversation commands")
  .argument("<task>", "task: list|get|export")
  .argument("[id]", "conversationId for get/export")
  .option("--limit <n>", "limit for list", "10")
  .action(async (task, id, options) => {
    const opts = program.opts();
    const api = createApiClient(opts.api, Number(opts.timeout));

    if (task === "list") {
      const limit = Number(options.limit ?? 10);
      const data = await api.get(`/api/conversations?limit=${limit}`);
      await printJsonOrTable(data.conversations ?? [], opts.json, {
        columns: ["conversationId", "title", "messageCount", "lastActivity"],
      });
      return;
    }

    if (task === "get") {
      if (!id) {
        logger.error("conv get requires an id");
        process.exit(2);
      }
      const data = await api.get(`/api/conversations/${id}`);
      await printJsonOrTable(data, opts.json);
      return;
    }

    if (task === "export") {
      if (!id) {
        logger.error("conv export requires an id");
        process.exit(2);
      }
      const data = await api.get(`/api/conversations/${id}/export`);
      await printJsonOrTable(data, opts.json);
      return;
    }

    logger.error("Unknown conv task. Use: list|get|export");
    process.exit(2);
  });

// dev health
program
  .command("dev")
  .description("Dev ops commands")
  .argument("<task>", "task: health")
  .option("--url <url>", "health URL", "http://localhost:3001/health")
  .action(async (task, options) => {
    const opts = program.opts();
    const api = createApiClient(undefined, Number(opts.timeout));

    if (task === "health") {
      const data = await api.get(options.url);
      await printJsonOrTable(data, opts.json);
      return;
    }

    logger.error("Unknown dev task. Use: health");
    process.exit(2);
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error(err.message || String(err));
  process.exit(1);
});