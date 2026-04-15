# AGENTS.md — oc-blackbytes

## Project

OpenCode plugin for workflow automation. Provides built-in MCP server provisioning, chat header injection for compatible providers, config management via JSONC, and structured file logging.

- **Entry point:** `src/index.ts` → `dist/index.js`
- **Runtime:** Bun (build, test, runtime)
- **Schema validation:** Zod v4
- **Config format:** JSONC (JSON with comments, via `jsonc-parser`)

## Commands

```
bun test          # run tests
bun run build     # compile src/index.ts → dist/index.js
bun run check     # lint + format check (Biome)
bun run lint      # lint only
bun run format    # format and fix
```

Linting and formatting use Biome. Run `bun run check` before committing.

## Architecture

### Module Layout

```
src/
├── index.ts                    # Plugin entry — exports BlackbytesPlugin
├── bootstrap.ts                # Hook assembly — creates config + chat.headers hooks
├── config/                     # Config loading and schema validation
│   ├── loader.ts               # loadConfigFromPath, loadPluginConfig
│   └── schema/                 # Zod schemas (config, MCP names, websearch)
├── shared/                     # Cross-cutting utilities
│   ├── constants/              # PLUGIN_NAME, CONFIG_BASENAME, LOG_FILENAME, CACHE_DIR_NAME
│   ├── opencode/               # OpenCode config dir resolution (CLI/Tauri/env override)
│   └── utils/                  # Buffered file logger, JSONC parser
├── handlers/                   # Hook handlers
│   ├── chat-headers-handler.ts # chat.headers hook — injects x-initiator header for Copilot
│   └── config-handler/         # config hook — orchestrates MCP merging
│       ├── index.ts            # handleConfig entry point
│       ├── types.ts            # ConfigContext type
│       └── mcp-config-handler.ts # MCP merging pipeline (builtin + user + disabled)
└── extensions/
    ├── mcp/                    # Built-in MCP server configs (websearch, context7, grep.app)
    ├── agents/                 # Agent type definitions and model detection utilities
    └── tools/
        └── hashline-edit/      # Hashline edit tool (description + constants, not yet wired)
```

### Key Modules

- **`config/`** — Discovers and validates `oc-blackbytes.json[c]` from the OpenCode config directory. Schema defined with Zod v4.
- **`shared/`** — Constants, buffered file logger (writes to `/tmp/oc-blackbytes.log`), JSONC parsing utilities, OpenCode config dir resolution for CLI and Tauri desktop.
- **`handlers/config-handler/`** — Orchestrates the `config` hook. Merges built-in MCPs with user-defined MCPs, respects `disabled_mcps` from config, preserves user-disabled entries.
- **`handlers/chat-headers-handler.ts`** — Handles the `chat.headers` hook. Injects `x-initiator: agent` header for GitHub Copilot and GitHub Copilot Enterprise providers.
- **`extensions/mcp/`** — Factory for built-in MCP servers: websearch (Exa/Tavily), Context7, grep.app. Controlled by plugin config.

### Plugin Flow

1. OpenCode loads `BlackbytesPlugin` from `dist/index.js`
2. Plugin receives `{ client, directory, worktree }` from OpenCode runtime
3. Returns a `config` hook that provisions MCP servers into OpenCode's config
4. Returns a `chat.headers` hook that injects `x-initiator: agent` for GitHub Copilot providers

## Important

- Types imported from `@opencode-ai/plugin` (`Plugin`, `Hooks`, `PluginInput`) and `@opencode-ai/sdk/v2` (`Config`, `McpRemoteConfig`).
- `tsconfig.json` exists for IDE support (`noEmit: true`). Build uses `bun build` directly.
- Tests use `bun:test`. Test file: `test/config.test.ts`. Uses temp dirs and `OPENCODE_CONFIG_DIR` env override for isolation.
- `dist/` is a build artifact — do not edit directly.
