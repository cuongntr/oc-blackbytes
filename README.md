# oc-blackbytes

An OpenCode plugin for workflow automation. Provisions built-in MCP servers, manages plugin configuration via JSONC, and provides structured file logging.

## Features

- **MCP server provisioning** — automatically configures built-in MCP servers (websearch via Exa/Tavily, Context7, grep.app)
- **JSONC config management** — loads plugin settings from `oc-blackbytes.json` or `oc-blackbytes.jsonc` with comments support
- **MCP merging pipeline** — merges built-in MCPs with user-defined servers, respects `disabled_mcps` and user-disabled entries
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

## Project Structure

```
oc-blackbytes/
├── src/
│   ├── index.ts              # Plugin entry — exports BlackbytesPlugin
│   ├── config/               # Config loading and Zod schema validation
│   ├── shared/               # Constants, logger, JSONC parser, config dir resolution
│   ├── extensions/mcp/       # Built-in MCP server configs
│   └── adapter/pipeline/     # MCP config merging pipeline
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
