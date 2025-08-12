## WP Aggregator AI - CLI Tool Checklist

Goal: Provide a simple CLI that accepts commands in the form:

```
wpai <ticket|conv|scrape|mcp|dev> <id|task> [args]
```

### 1) Core command format (`ticket id task args`)
- Input pattern: `ticket <ticketId> <task> [args...]`
- Examples:
  - `ticket 12345 get` — fetch ticket details
  - `ticket 12345 comments` — list comments
  - `ticket 12345 save --db` — save to DB
  - `ticket 12345 scrape --force` — scrape fresh from Trac

### 2) Subcommands (MVP)
- ticket
  - get
  - comments
  - save [--db]
  - scrape [--force]
- conv (conversation)
  - list [--limit N]
  - get <conversationId>
  - export <conversationId> [--out file.json]
  - delete <conversationId>
- mcp
  - search "query" [--limit N]
  - get <toolName> --args '{"k":"v"}'
- dev
  - start [--frontend 3000] [--backend 3001]
  - health [--url http://localhost:3001/health]
- scrape
  - tickets --recent [--limit N]
  - ticket <ticketId> [--force]

### 3) Flags & global options
- `--json` — output raw JSON
- `--pretty` — pretty print output (default)
- `--quiet` — minimal logs
- `--verbose` — extra logs
- `--api <url>` — override API base URL
- `--env <path>` — .env path override

### 4) Output formats
- Human-friendly table/list for default
- JSON when `--json` is passed
- Exit codes:
  - 0 success
  - 1 generic failure
  - 2 invalid arguments
  - 3 network/API error

### 5) Project integration
- Uses existing endpoints:
  - Conversations API: list/get/export/delete
  - Tickets routes: save/scrape/get
  - MCP proxy: /api/mcp tools
- Respects `.env` and `VITE_API_BASE_URL`/`PORT`

### 6) Suggested command aliases
- `wpai t 12345 get`
- `wpai c list --limit 10`
- `wpai m search "WordPress core" --limit 5`
- `wpai d start --frontend 4000 --backend 4001`

### 7) Implementation plan (MVP)
- Node.js bin script `bin/wpai` using `commander`
- Central API client (reuse `API_ENDPOINTS`/env)
- Commands as modules: `commands/ticket.ts`, `commands/conv.ts`, etc.
- Shared logger (quiet/verbose), formatter (json/pretty)

### 8) Nice-to-haves
- Shell completion (bash/zsh)
- `.wpairc` for defaults
- Colorized output
- Progress spinners for long ops
- Piped input support for bulk tasks

### 9) Security & safety
- Avoid printing secrets
- Handle network and 4xx/5xx robustly
- Timeouts/retries for network calls

### 10) Examples
```
# Tickets
wpai ticket 12345 get --json
wpai ticket 12345 scrape --force

# Conversations
wpai conv list --limit 5
wpai conv get 4f7a6c44-... --json
wpai conv export 4f7a6c44-... --out convo.json

# MCP
wpai mcp search "Gutenberg list block" --limit 3

# Dev
wpai dev start --frontend 3004 --backend 3005
wpai dev health --url http://localhost:3002/health
```