# Cursor Setup — threejs-devtools-mcp

## Option A: stdio (recommended)

1. Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "threejs-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"]
    }
  }
}
```

2. Restart Cursor (or reload the window)
3. Open **Settings → MCP** — you should see `threejs-devtools-mcp` listed and enabled
4. Start your dev server (`npm run dev`)
5. A browser window opens automatically at `localhost:9222` with the bridge injected
6. Ask the AI to inspect your scene — e.g. *"show me the scene tree"*

If the browser doesn't open, set `BROWSER=none` and open `http://localhost:9222` manually.

## Option B: HTTP transport

1. Start the MCP HTTP server in a separate terminal:

```bash
npx threejs-devtools-mcp-http
```

2. Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "threejs-devtools-mcp": {
      "url": "http://localhost:9223/mcp"
    }
  }
}
```

3. Restart Cursor, start your dev server, open `localhost:9222`

## Troubleshooting

- **"Bridge not connected"** — make sure `localhost:9222` is open in a browser (not your regular dev URL)
- **Wrong dev port** — tell the AI *"set dev port to 5173"* or set `DEV_PORT=5173`
- **MCP not showing in Cursor** — restart Cursor completely, check `.cursor/mcp.json` syntax
