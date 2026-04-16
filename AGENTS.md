# AGENTS.md — oc-blackbytes

## Project

OpenCode plugin for workflow automation. Provides built-in MCP server provisioning, built-in agents, bundled local tools, chat header injection for compatible providers, hashline post-processing for structured editing, config management via JSONC, and structured file logging.

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
├── bootstrap.ts                # Hook assembly — creates config, chat.headers, chat.params, tool, and tool.execute.after hooks
├── config/                     # Config loading and schema validation
│   ├── loader.ts               # loadConfigFromPath, loadPluginConfig
│   └── schema/                 # Zod schemas (config, MCP names, websearch, per-agent model config)
├── compat/                     # Compatibility layers
├── integrations/               # External/runtime integrations
├── services/                   # Model fallback resolution (provider discovery, fallback chains)
├── stores/                     # Reserved state stores
├── shared/                     # Cross-cutting utilities
│   ├── constants/              # PLUGIN_NAME, CONFIG_BASENAME, LOG_FILENAME, CACHE_DIR_NAME
│   ├── opencode/               # OpenCode config dir resolution (CLI/Tauri/env override)
│   └── utils/                  # Buffered file logger, JSONC parser
├── handlers/                   # Hook handlers
│   ├── chat-headers-handler.ts   # chat.headers hook — injects x-initiator header for Copilot
│   ├── chat-params-handler.ts    # chat.params hook — runtime model parameter adaptation per agent+model
│   ├── tool-handler.ts           # tool hook — registers bundled local tools
│   ├── tool-execute-after-handler.ts # tool.execute.after hook — post-processes read/write output
│   └── config-handler/           # config hook — orchestrates MCP and agent merging
│       ├── index.ts              # handleConfig entry point
│       ├── types.ts              # ConfigContext type
│       ├── mcp-config-handler.ts # MCP merging pipeline (builtin + user + disabled)
│       ├── agent-config-handler.ts # Agent merging pipeline (builtin + user + disabled)
│   ├── command-config-handler.ts # Command config handling (built-in command registration)
└── extensions/
    ├── agents/                 # bytes, explore, oracle, librarian, and general definitions
    ├── commands/               # Built-in slash commands (setup-models)
    ├── hooks/                  # Hook-related extension helpers
    ├── hooks/                  # Hook-related extension helpers
    ├── mcp/                    # Built-in MCP server configs (websearch, context7, grep.app)
    ├── skills/                 # Skill extension entrypoints
    └── tools/
        ├── hashline-edit/      # Hashline edit tool and runtime behavior
        ├── ast-grep/           # AST-aware search and replace tools
        ├── grep/               # Regex search tool
        └── glob/               # File globbing tool
```

### Key Modules

- **`config/`** — Discovers and validates `oc-blackbytes.json[c]` from the OpenCode config directory. Schema defined with Zod v4.
- **`shared/`** — Constants, buffered file logger (writes to `/tmp/oc-blackbytes.log`), JSONC parsing utilities, OpenCode config dir resolution for CLI and Tauri desktop.
- **`handlers/config-handler/`** — Orchestrates the `config` hook. Merges built-in MCPs, agents, and commands with user-defined config, respects `disabled_mcps` / `disabled_agents`, preserves explicit user disables, applies per-agent model overrides from the `agents` config field, and sets `default_agent` to `bytes` when appropriate.
- **`handlers/chat-headers-handler.ts`** — Handles the `chat.headers` hook. Injects `x-initiator: agent` header for GitHub Copilot and GitHub Copilot Enterprise providers.
- **`handlers/chat-params-handler.ts`** — Handles the `chat.params` hook. Detects the actual model family at runtime and applies provider-correct thinking/reasoning config per agent, stripping incompatible options for other providers.
- **`handlers/tool-handler.ts`** — Registers `hashline_edit`, `ast_grep_search`, `ast_grep_replace`, `grep`, and `glob`, filtered by `disabled_tools` and `hashline_edit`.
- **`handlers/tool-execute-after-handler.ts`** — Rewrites `read` output into `LINE#ID|content` anchors and normalizes successful `write` output into line-count summaries when hashline editing is enabled.
- **`extensions/mcp/`** — Factory for built-in MCP servers: websearch (Exa/Tavily), Context7, grep.app. Controlled by plugin config.
- **`extensions/agents/`** — Factory for built-in agents: `bytes`, `explore`, `oracle`, `librarian`, and `general`, including model-aware prompt selection, language matching (all agents detect user language and respond in kind), and OpenCode `permission` map generation. After config merging, each agent's prompt is appended with an `<available_resources>` section listing the enabled tools, MCP servers, and peer agents.
- **`extensions/tools/`** — Tool definitions for hashline editing, AST-aware search/replace, regex search, and glob search.
- **`extensions/commands/`** — Definitions for built-in slash commands. Each command specifies a template, description, and optional agent/model binding.

### Plugin Flow

1. OpenCode loads `BlackbytesPlugin` from `dist/index.js`
2. Plugin receives `{ client, directory, worktree }` from OpenCode runtime
3. Loads `oc-blackbytes.json[c]` from the resolved OpenCode config directory
4. Returns a `config` hook that provisions MCP servers, built-in agents, and commands into OpenCode's config, then injects runtime context (`<available_resources>`) into each enabled agent's prompt reflecting the final state of enabled tools, MCPs, and peer agents
5. Returns a `chat.headers` hook that injects `x-initiator: agent` for supported GitHub Copilot providers
6. Returns a `chat.params` hook that adapts model parameters at runtime based on actual model family and agent role
7. Returns a `tool` hook that registers bundled local tools
8. Returns a `tool.execute.after` hook that post-processes `read` and `write` output for hashline editing workflows

## Important

- Types imported from `@opencode-ai/plugin` (`Plugin`, `Hooks`, `PluginInput`) and `@opencode-ai/sdk/v2` (`Config`, `McpRemoteConfig`).
- `tsconfig.json` exists for IDE support (`noEmit: true`). Build uses `bun build` directly.
- Tests use `bun:test`. Test file: `test/config.test.ts`. Uses temp dirs and `OPENCODE_CONFIG_DIR` env override for isolation.
- `dist/` is a build artifact — do not edit directly.
- Built-in MCPs: `websearch`, `context7`, `grep_app`.
- Built-in agents: `bytes`, `explore`, `oracle`, `librarian`, `general`.
- Bundled tools: `hashline_edit`, `ast_grep_search`, `ast_grep_replace`, `grep`, `glob`.
- Built-in commands: `setup-models`.
- Language matching is built into every agent's prompt: agents detect the user's language and respond in the same language; code, technical terms, file paths, tool names, and git messages remain in English.
- The `bytes` agent has `question: "allow"` permission, enabling it to ask clarifying questions via OpenCode's built-in question tool when a task is ambiguous.
