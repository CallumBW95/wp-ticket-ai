#!/usr/bin/env node
import { Command } from "commander";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pkg from "../../package.json" assert { type: "json" };
import { createApiClient } from "./lib/api";
import { printJsonOrTable, logger, setLogLevel } from "./lib/io";
import { z } from "zod";
import { writeFileSafe } from "./lib/fs";
import path from "path";

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

// ticket
const ticketCmd = program
  .command("ticket")
  .description(
    "Ticket commands: get|comments|next-steps|analyze-patch|gen-tests|scaffold-plugin"
  )
  .argument("<ticketId>", "Trac ticket id (number)")
  .argument(
    "<task>",
    "task: get|comments|next-steps|analyze-patch|gen-tests|scaffold-plugin"
  )
  .option("--patch <file>", "path to patch file for analyze-patch")
  .option("--out <dir>", "output directory for generated files", "./out")
  .addHelpText(
    "after",
    `\nExamples:\n  $ wpai ticket 12345 get\n  $ wpai ticket 12345 comments --json\n  $ wpai ticket 12345 next-steps\n  $ wpai ticket 12345 analyze-patch --patch ./diff.patch --json\n  $ wpai ticket 12345 gen-tests --out ./sandbox\n  $ wpai ticket 12345 scaffold-plugin --out ./sandbox\n`
  );

ticketCmd.action(async (ticketId, task, options) => {
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

  if (task === "next-steps") {
    const data = await api.get(`/api/tickets/${idNum}`);
    const steps: string[] = [];
    if (data.status === "new") steps.push("Triage: confirm reproducibility and scope");
    if (data.attachments?.length) steps.push("Review attachments/patches for coding standards");
    if ((data.comments ?? []).length < 1) steps.push("Request more details from reporter");
    steps.push("Check related changesets and impacted components");
    await printJsonOrTable(
      steps.map((s, i) => ({ step: i + 1, action: s })),
      opts.json,
      { columns: ["step", "action"] }
    );
    return;
  }

  if (task === "analyze-patch") {
    if (!options.patch) {
      logger.error("--patch <file> is required for analyze-patch");
      process.exit(2);
    }
    const analysis = {
      ticketId: idNum,
      summary:
        "Static analysis placeholder: check coding standards, test coverage, and backwards compatibility.",
      checks: [
        "PHP coding standards (PHPCS)",
        "Docs blocks & function signatures",
        "Backward compatibility surface",
        "Unit/integration test coverage",
      ],
    };
    await printJsonOrTable(analysis, opts.json);
    return;
  }

  if (task === "gen-tests") {
    const outDir = path.resolve(String(options.out));
    const pluginSlug = `wpai-ticket-${idNum}-tests`;
    const pluginDir = path.join(outDir, pluginSlug);
    const testPhp = `<?php\n/**\n * Tests for ticket #${idNum}.\n *\n * @group ticket-${idNum}\n */\nclass Tests_Ticket_${idNum} extends WP_UnitTestCase {\n\tpublic function test_placeholder() {\n\t\t$this->assertTrue(true);\n\t}\n}\n`;
    await writeFileSafe(path.join(pluginDir, "tests", `test-ticket-${idNum}.php`), testPhp);
    logger.info(`✅ Generated unit test skeleton at ${path.join(pluginDir, "tests")}`);
    return;
  }

  if (task === "scaffold-plugin") {
    const outDir = path.resolve(String(options.out));
    const pluginSlug = `wpai-ticket-${idNum}`;
    const pluginDir = path.join(outDir, pluginSlug);
    const mainPhp = `<?php\n/**\n * Plugin Name: WP AI Ticket ${idNum} Sandbox\n * Description: Sandbox plugin scaffold for testing ticket #${idNum}.\n * Version: 0.1.0\n */\n`;
    const readme = `# Ticket ${idNum} Sandbox\n\nUse this plugin to reproduce and verify fixes for ticket ${idNum}.\n`;
    await writeFileSafe(path.join(pluginDir, `${pluginSlug}.php`), mainPhp);
    await writeFileSafe(path.join(pluginDir, "readme.md"), readme);
    await writeFileSafe(path.join(pluginDir, "tests", ".gitkeep"), "");
    logger.info(`✅ Scaffolded plugin at ${pluginDir}`);
    return;
  }

  logger.error(
    "Unknown task for ticket. Use: get|comments|next-steps|analyze-patch|gen-tests|scaffold-plugin"
  );
  process.exit(2);
});

// conv
program
  .command("conv")
  .description("Conversation commands: list|get|export")
  .argument("<task>", "task: list|get|export")
  .argument("[id]", "conversationId for get/export")
  .option("--limit <n>", "limit for list", "10")
  .addHelpText(
    "after",
    `\nExamples:\n  $ wpai conv list --limit 5\n  $ wpai conv get 4f7a6c44-...\n  $ wpai conv export 4f7a6c44-... --json\n`
  )
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

// dev
program
  .command("dev")
  .description("Dev ops commands: health")
  .argument("<task>", "task: health")
  .option("--url <url>", "health URL", "http://localhost:3001/health")
  .addHelpText("after", `\nExample:\n  $ wpai dev health --url http://localhost:3002/health\n`)
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