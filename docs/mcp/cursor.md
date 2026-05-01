# Cursor

Cursor supports MCP via its built-in MCP settings panel.

## 1. Open MCP settings

`Cmd ,` → **MCP** → **+ Add new MCP server**.

## 2. Paste the config

```jsonc
{
  "name": "cognia",
  "command": "npx",
  "args": ["-y", "@cogniahq/mcp"],
  "env": {
    "COGNIA_API_KEY": "ck_live_…"
  }
}
```

## 3. Toggle the server on

A green dot next to `cognia` means it's running.

## 4. Use the tools

In a chat or composer, the tools are auto-available. You can also explicitly invoke:

> @cognia search for the indemnity clause in our standard MSA

Cursor will route the call through `cognia_search`.

## Troubleshooting

**Server stuck "starting…"**

Click the **logs** icon next to the server entry. The most common issues mirror [Claude Desktop's troubleshooting](./claude-desktop) — invalid JSON, missing `npx`, bad API key.
