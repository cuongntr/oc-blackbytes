# oc-blackbytes

An OpenCode plugin tailored to streamline everyday workflows. Injects environment variables into shell commands and logs all OpenCode events for observability.

## Features

- **Shell environment injection** — sets `BLACKBYTES_ENABLED=1` in all shell commands run by OpenCode
- **Event logging** — captures and logs every OpenCode event (session lifecycle, tool calls, file edits, etc.)
- **Structured logging** — uses `client.app.log()` for traceable, filterable logs

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

## Project Structure

```
oc-blackbytes/
├── src/
│   └── index.ts          # Plugin source (single entry point)
├── test/
│   └── index.test.ts     # Tests with bun:test
├── docs/
│   ├── plugin-architecture.md   # Plugin types, hooks, and architecture
│   └── debugging.md             # Debugging guide and workflows
├── dist/
│   └── index.js          # Build output (bun build)
├── package.json
├── biome.json            # Linting/formatting config
└── AGENTS.md             # Agent instructions
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

# View log files
# macOS/Linux: ~/.local/share/opencode/log/
```

## Architecture

See [docs/plugin-architecture.md](docs/plugin-architecture.md) for a deep dive into OpenCode's plugin system — `PluginInput`, `PluginOptions`, `Hooks`, and the input/output hook pattern.

## Publish

Bump the version in `package.json`, then:

```bash
bun run build
npm publish
```

## License

MIT
