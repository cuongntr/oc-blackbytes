# oc-blackbytes

An OpenCode plugin for workflow automation. Provisions built-in MCP servers, injects chat headers for compatible providers, manages plugin configuration via JSONC, and provides structured file logging.

## Features

- **MCP server provisioning** — automatically configures built-in MCP servers (websearch via Exa/Tavily, Context7, grep.app)
- **MCP merging pipeline** — merges built-in MCPs with user-defined servers, respects `disabled_mcps` and user-disabled entries
- **Chat headers hook** — injects `x-initiator: agent` header for GitHub Copilot providers
- **JSONC config management** — loads plugin settings from `oc-blackbytes.json` or `oc-blackbytes.jsonc` with comments support
- **Structured file logging** — buffered logger writes to `/tmp/oc-blackbytes.log`

## Installation

### From npm

```bash
npm install oc-blackbytes
```

Then add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["oc-blackbytes"]
}
```

### From local development

Point your `opencode.json` at the local package path:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/oc-blackbytes"]
}
```

Verify the plugin loads:

```bash
opencode debug config
```

## Configuration

Create `oc-blackbytes.jsonc` in your OpenCode config directory:

```jsonc
{
  // Disable specific built-in MCP servers
  "disabled_mcps": ["grep_app"],

  // Websearch provider: "exa" (default) or "tavily"
  "websearch": {
    "provider": "exa"
  }
}
```

### Config Options

| Option | Type | Default | Description |
|---|---|---|---|
| `disabled_mcps` | `string[]` | `[]` | MCP server names to disable entirely |
| `websearch` | `{ provider: "exa" \| "tavily" }` | `{ provider: "exa" }` | Websearch MCP provider selection |

### Built-in MCP Servers

| Server | Auth | Notes |
|---|---|---|
| **websearch** (Exa) | Optional `EXA_API_KEY` | Appended to URL for authenticated access. Works without a key. |
| **websearch** (Tavily) | Required `TAVILY_API_KEY` | Bearer auth. Server is skipped if the key is missing. |
| **context7** | Optional `CONTEXT7_API_KEY` | Bearer auth header added if present. |
| **grep_app** | None | No authentication required. |

### Environment Variables

| Variable | Required | Effect |
|---|---|---|
| `EXA_API_KEY` | No | Authenticated access for the Exa websearch provider |
| `TAVILY_API_KEY` | Yes (if provider is `tavily`) | Bearer auth; websearch MCP is skipped without it |
| `CONTEXT7_API_KEY` | No | Bearer auth for the Context7 MCP |
| `OPENCODE_CONFIG_DIR` | No | Override the OpenCode config directory path |

## Project Structure

```
oc-blackbytes/
├── src/
│   ├── index.ts              # Plugin entry — exports BlackbytesPlugin
│   ├── bootstrap.ts          # Hook assembly (config + chat.headers)
│   ├── config/               # Config loading and Zod schema validation
│   ├── shared/               # Constants, logger, JSONC parser, config dir resolution
│   ├── handlers/             # Hook handlers (config merging, chat headers)
│   └── extensions/           # Built-in MCP servers, agent types, tool definitions
├── test/
│   └── config.test.ts        # Config loader tests (bun:test)
├── docs/
│   └── debugging.md
├── dist/
│   └── index.js              # Build output (bun build)
├── package.json
├── tsconfig.json             # IDE support (noEmit)
├── biome.json                # Linting/formatting config
└── AGENTS.md                 # Agent instructions
```

## Commands

```bash
bun test          # Run tests
bun run build     # Compile src/index.ts → dist/index.js
bun run check     # Lint + format check (Biome)
bun run lint      # Lint only
bun run format    # Format and fix
```

## Debugging

See [docs/debugging.md](docs/debugging.md) for the full debugging guide. Quick reference:

```bash
# Stream logs to terminal
opencode --print-logs --log-level DEBUG

# View plugin file logs
cat /tmp/oc-blackbytes.log
```

## Publish

Bump the version in `package.json`, then:

```bash
bun run build
npm publish
```

## License

MIT
