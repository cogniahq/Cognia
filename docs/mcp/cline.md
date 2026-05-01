# Cline / Continue / Zed

Most VSCode-resident MCP clients use the same JSON config shape.

## Cline

Edit `~/.cline/mcp_settings.json`:

```json
{
  "mcpServers": {
    "cognia": {
      "command": "npx",
      "args": ["-y", "@cogniahq/mcp"],
      "env": { "COGNIA_API_KEY": "ck_live_…" }
    }
  }
}
```

## Continue

`~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServer": {
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@cogniahq/mcp"]
      },
      "env": {
        "COGNIA_API_KEY": "ck_live_…"
      }
    }
  }
}
```

## Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "cognia": {
      "command": {
        "path": "npx",
        "args": ["-y", "@cogniahq/mcp"],
        "env": { "COGNIA_API_KEY": "ck_live_…" }
      },
      "settings": {}
    }
  }
}
```

## Troubleshooting

If a client refuses to start the server:

```sh
COGNIA_API_KEY=ck_live_… npx -y @cogniahq/mcp
```

You should see `cognia-mcp: ready (stdio)` on stderr and the server should hang waiting for input. Press `Ctrl-C` to exit. If that works, the issue is in the client config; if it doesn't, check your API key and network egress.
