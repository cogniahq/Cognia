# Claude Desktop

## 1. Open the config file

| OS | Path |
|---|---|
| macOS   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux   | `~/.config/Claude/claude_desktop_config.json` |

If it doesn't exist, create it with `{ "mcpServers": {} }`.

## 2. Add the Cognia server

```jsonc
{
  "mcpServers": {
    "cognia": {
      "command": "npx",
      "args": ["-y", "@cogniahq/mcp"],
      "env": {
        "COGNIA_API_KEY": "ck_live_…"
      }
    }
  }
}
```

::: tip
The `-y` flag auto-accepts npx's "install latest?" prompt. Without it, Claude will hang silently waiting for input.
:::

## 3. Restart Claude Desktop

Quit and re-open. After ~5 seconds, the MCP icon (looks like a tiny plug) appears next to the `+` button. Click it — you should see `cognia` listed with three tools.

## 4. Test it

Ask Claude something like:

> What do my notes say about the renewal terms in the Acme contract?

Claude will surface a tool-call indicator, run `cognia_search`, and answer using the returned snippets — with citations.

## Troubleshooting

**The plug icon doesn't appear**

Open the Claude logs:

- macOS: `~/Library/Logs/Claude/mcp*.log`
- Windows: `%APPDATA%\Claude\logs\mcp*.log`

Common causes:

- Invalid JSON in the config file (validate at https://jsonlint.com)
- `npx` not on PATH — restart your shell, or replace `command: "npx"` with the absolute path (e.g. `/opt/homebrew/bin/npx`)
- API key still has placeholder text

**The icon is there but tools fail**

Check the log for `cognia-mcp:` lines. The most common errors:

- `unauthorized (401)` — API key is wrong or revoked. Generate a new one.
- `forbidden (403)` — Key is missing the `search` or `memories.read` scope.
- `network` — Egress blocked. If you're behind a VPN, allow `*.cognia.xyz`.

## Pinning a version

`npx -y @cogniahq/mcp` always grabs the latest. To pin:

```jsonc
{
  "mcpServers": {
    "cognia": {
      "command": "npx",
      "args": ["-y", "@cogniahq/mcp@0.1.0"],
      "env": { "COGNIA_API_KEY": "ck_live_…" }
    }
  }
}
```

Or install globally and reference the binary directly:

```sh
npm install -g @cogniahq/mcp
which cognia-mcp   # /opt/homebrew/bin/cognia-mcp
```

```jsonc
{
  "mcpServers": {
    "cognia": {
      "command": "/opt/homebrew/bin/cognia-mcp",
      "env": { "COGNIA_API_KEY": "ck_live_…" }
    }
  }
}
```
