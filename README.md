# oc-blackbytes

OpenCode plugin for workflow automation. It provisions built-in MCP servers, installs a primary agent plus specialized subagents, registers local search and editing tools, provides guided setup commands, adapts model parameters at runtime, injects compatible chat headers, and loads plugin configuration from JSONC.

## What the plugin does

The plugin wires these OpenCode hook surfaces:

- `config` — merges built-in MCP servers, agents, and commands into the active OpenCode config
- `chat.headers` — injects `x-initiator: agent` for supported GitHub Copilot providers
- `chat.params` — adapts provider-specific model parameters from the actual runtime model family and agent role
- `tool` — registers bundled local tools for structural search, regex search, globbing, and anchored editing
- `tool.execute.after` — rewrites `read` output into `LINE#ID` anchors and normalizes successful `write` output when hashline editing is enabled

## Features

- **Built-in MCP provisioning** — `websearch`, `context7`, and `grep_app`
- **Built-in agents** — `bytes`, `explore`, `oracle`, `librarian`, and `general`
- **Built-in commands** — `/setup-models` for agent model assignments and `/setup-lsp` for guided OpenCode core LSP setup
- **Per-agent model overrides** — configure `model`, `reasoningEffort`, `temperature`, and `fallback_models`
- **Provider-aware fallback resolution** — discover connected providers and resolve fallback chains when `model_fallback` is enabled
- **Runtime model parameter adaptation** — Claude thinking, OpenAI reasoning effort, and provider-option stripping happen automatically from the runtime model family
- **Bundled tools** — `hashline_edit`, `ast_grep_search`, `ast_grep_replace`, `grep`, and `glob`
- **Hashline editing workflow** — `read` output becomes `LINE#ID|content` and `write` output becomes a concise line-count summary
- **Dynamic agent resource injection** — every enabled agent prompt gets an `<available_resources>` section describing oc-blackbytes-managed bundled tools, MCPs, and peer agents without implying a complete OpenCode runtime inventory
- **JSONC config loading** — supports comments and trailing commas in `oc-blackbytes.jsonc`
- **Structured logging** — writes buffered logs to `/tmp/oc-blackbytes.log`
- **Binary auto-installation** — caches `rg` and `sg` automatically for bundled search tools
- **Language matching** — agents respond in the user’s language while keeping code, technical terms, file paths, tool names, and git messages in English
- **Clarifying questions** — `bytes` has question permission and can ask focused follow-ups when a task is ambiguous
- **OpenCode core LSP guidance** — Bytes, Explore, and General use the OpenCode core `lsp` tool conditionally for semantic navigation when it is enabled, with immediate fallback to bundled search/read tools

## Installation

### From npm

```bash
npm install oc-blackbytes
```

Add the plugin to `opencode.json` or `opencode.jsonc`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["oc-blackbytes"]
}
```

### From a local checkout

Point OpenCode at the local package directory:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/oc-blackbytes"]
}
```

Build the plugin, then inspect the resolved config:

```bash
bun run build
opencode debug config
```

## Quick start

Create `oc-blackbytes.jsonc` in the OpenCode config directory:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  "hashline_edit": true,
  "model_fallback": true,

  "websearch": {
    "provider": "exa"
  },

  "agents": {
    "oracle": { "model": "openai/gpt-5.4", "reasoningEffort": "high" },
    "explore": { "model": "google/gemini-3-flash", "temperature": 0.1 },
    "librarian": { "model": "minimax/minimax-m2.7" },
    "general": { "model": "anthropic/claude-sonnet-4-6" }
  },

  "fallback_models": [
    "anthropic/claude-sonnet-4-6",
    { "model": "openai/gpt-4.1", "reasoningEffort": "medium" }
  ]
}
```

For the full configuration guide, see [docs/configuration.md](docs/configuration.md).

### Built-in setup commands

Use `/setup-models` to generate or update `oc-blackbytes.jsonc` model assignments for `oracle`, `explore`, `librarian`, and `general`. The command discovers available OpenCode models, recommends role-appropriate assignments, and preserves unrelated plugin config fields when merging changes.

Use `/setup-lsp` to configure OpenCode core LSP support safely. The command targets OpenCode config files such as `config.json`, `opencode.json`, or `opencode.jsonc`, not `oc-blackbytes.jsonc`; explains the experimental `OPENCODE_EXPERIMENTAL_LSP_TOOL=true` and `OPENCODE_EXPERIMENTAL=true` flags; proposes `permission.lsp = "allow"`; and asks for confirmation before editing user config.

## Built-in agents

The plugin sets `default_agent` to `bytes` when the user has not already chosen a default. Built-in `build` and `plan` are marked disabled unless the user configures them explicitly.

| Agent | Mode | Purpose |
|---|---|---|
| `bytes` | Primary | End-to-end coding agent for implementation, debugging, planning, review, and delegation |
| `explore` | Subagent | Read-only codebase search specialist for broad discovery |
| `oracle` | Subagent | Read-only high-reasoning advisor for architecture, debugging escalation, and self-review |
| `librarian` | Subagent | Read-only research agent for external docs, remote repositories, and library usage examples |
| `general` | Subagent | Write-capable executor for multi-file implementation, migrations, and scoped refactors |

### Runtime agent context

Each enabled agent prompt is extended with an `<available_resources>` section assembled from the final merged config. That section includes:

- enabled bundled tools
- enabled MCP servers
- enabled peer agents

Disabling a built-in MCP or bundled tool automatically removes it from agent prompts as well as from runtime registration.

The runtime resource section describes resources managed by `oc-blackbytes`. OpenCode core tools such as `lsp` are governed by the OpenCode runtime, feature flags, and permissions rather than by `disabled_tools`.

## Built-in MCP servers

| Server | Notes |
|---|---|
| `websearch` | Uses Exa by default; can switch to Tavily with `websearch.provider` |
| `context7` | Queries current library/framework documentation and code examples |
| `grep_app` | Searches public GitHub repositories for real-world code examples |

### Websearch providers

- `exa` — default; works without an API key and appends `EXA_API_KEY` when present
- `tavily` — requires `TAVILY_API_KEY`; when the key is missing, the built-in `websearch` MCP entry is omitted

## Bundled tools

| Tool | Purpose |
|---|---|
| `hashline_edit` | Precise file edits anchored by `LINE#ID` tokens |
| `ast_grep_search` | AST-aware structural search across 25 languages |
| `ast_grep_replace` | AST-aware structural rewrite with dry-run by default |
| `grep` | Regex content search with `content`, `files_with_matches`, and `count` modes |
| `glob` | Fast file matching with glob patterns |

### Hashline workflow

When `hashline_edit` is enabled:

1. `read` output is rewritten to `LINE#ID|content`
2. edits reference those exact anchors through `hashline_edit`
3. successful `write` output is replaced with `File written successfully. N lines written.`

This keeps editing precise, compact, and safe across repeated changes.

## OpenCode core LSP

OpenCode's experimental core `lsp` tool is available to agents when OpenCode exposes it in the runtime tool inventory. `oc-blackbytes` does not register a bundled `lsp` tool; it documents and prompts for safe use of the OpenCode core capability.

Enable the core tool in the OpenCode process with one of these environment flags:

```bash
OPENCODE_EXPERIMENTAL_LSP_TOOL=true
# or
OPENCODE_EXPERIMENTAL=true
```

Allow the tool in OpenCode config when you want agents to call it without repeated prompts:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "lsp": "allow"
  }
}
```

The core tool supports semantic operations such as `goToDefinition`, `findReferences`, `hover`, `documentSymbol`, `workspaceSymbol`, `goToImplementation`, and call hierarchy operations. It uses 1-based `line` and `character` coordinates. Agents fall back to `glob`, `grep`, `ast_grep_search`, and `read` when `lsp` is unavailable, unconfigured, or inconclusive.

See [docs/configuration.md](docs/configuration.md#opencode-core-lsp-facts) for the exact operation list, argument schema, config precedence notes, and LSP server config shape.

### AST-aware search and replace

`ast_grep_search` and `ast_grep_replace` support complete AST-node patterns with meta-variables:

- `$VAR` — single AST node
- `$$$` — multiple nodes

Examples:

```text
console.log($MSG)
export async function $NAME($$$) { $$$ }
def $FUNC($$$)
```

Supported languages:

`bash`, `c`, `cpp`, `csharp`, `css`, `elixir`, `go`, `haskell`, `html`, `java`, `javascript`, `json`, `kotlin`, `lua`, `nix`, `php`, `python`, `ruby`, `rust`, `scala`, `solidity`, `swift`, `typescript`, `tsx`, `yaml`

## Configuration reference

| Option | Type | Default | Description |
|---|---|---|---|
| `disabled_mcps` | `string[]` | `[]` | Removes MCP entries by name after merge |
| `disabled_agents` | `string[]` | `[]` | Removes built-in or merged agent entries by name |
| `disabled_tools` | `string[]` | `[]` | Prevents bundled tools from being registered |
| `hashline_edit` | `boolean` | `true` | Enables `hashline_edit` plus `tool.execute.after` post-processing for `read` and `write` |
| `model_fallback` | `boolean` | `false` | Enables provider discovery and fallback-chain resolution |
| `websearch.provider` | `"exa" \| "tavily"` | `"exa"` | Selects the built-in websearch backend |
| `agents` | `Record<string, AgentModelConfig>` | `{}` | Per-agent overrides for `model`, `reasoningEffort`, `temperature`, and `fallback_models` |
| OpenCode core `lsp` | OpenCode config + env flags | Not a plugin option | Controlled by OpenCode runtime availability, `permission.lsp`, and experimental flags; not affected by `disabled_tools` |
| `fallback_models` | `string \| (string \| object)[]` | — | Global fallback chain tried after a per-agent chain |

See [docs/configuration.md](docs/configuration.md) for full examples, model recommendations, and fallback behavior.

## Runtime model behavior

The `chat.params` hook uses the actual runtime model, not just the configured hint.

- **Claude** — applies thinking budgets for `bytes`, `oracle`, and `general` when reasoning is supported
- **OpenAI** — applies reasoning effort defaults for `bytes`, `oracle`, and `general` when reasoning is supported
- **Gemini / other providers** — strips provider-specific options that do not apply
- **`explore` and `librarian`** — skip default reasoning/thinking configuration for speed

User overrides from `agents.<name>` take precedence where applicable.

## Chat header behavior

For `github-copilot` and `github-copilot-enterprise`, the plugin injects:

```http
x-initiator: agent
```

This header is skipped for the `@ai-sdk/github-copilot` API integration path.

## Configuration file discovery

The plugin resolves configuration from the active OpenCode config directory and looks for:

- `oc-blackbytes.jsonc`
- `oc-blackbytes.json`

`OPENCODE_CONFIG_DIR` overrides the CLI config directory. Desktop builds use the relevant Tauri config directories and fall back to the CLI location when an existing CLI config is present.

## Environment variables

| Variable | Required | Effect |
|---|---|---|
| `EXA_API_KEY` | No | Appends authenticated Exa access to the `websearch` MCP URL |
| `TAVILY_API_KEY` | Yes, for Tavily | Enables the Tavily-backed `websearch` MCP |
| `CONTEXT7_API_KEY` | No | Adds bearer auth to the `context7` MCP |
| `OPENCODE_CONFIG_DIR` | No | Overrides the OpenCode config directory used for plugin config discovery |
| `OPENCODE_EXPERIMENTAL_LSP_TOOL` | Yes, for core LSP | Enables OpenCode's experimental core `lsp` tool for the OpenCode process |
| `OPENCODE_EXPERIMENTAL` | Alternative for core LSP | Enables OpenCode experimental features, including the core `lsp` tool |
| `OPENCODE_DISABLE_LSP_DOWNLOAD` | No | Disables OpenCode automatic language-server binary downloads without enabling or disabling the `lsp` tool |
| `XDG_CONFIG_HOME` | No | Influences CLI config discovery on Linux-compatible environments |
| `XDG_CACHE_HOME` | No | Influences plugin cache resolution on Linux-compatible environments |
| `LOCALAPPDATA` / `APPDATA` | No | Influences cache and config resolution on Windows |

## Commands

```bash
bun run build          # Compile src/index.ts -> dist/index.js
bun test               # Run bun:test suites except e2e tests
bun run test:unit      # Run unit tests with coverage
bun run test:e2e       # Run deterministic e2e tests
bun run lint           # Run Biome lint checks
bun run format         # Apply Biome formatting
bun run check          # Run Biome check, unit tests, and e2e tests
bun run prepublishOnly # Build before publish
```

## Development workflow

```bash
bun install
bun test
bun run check
bun run build
```

During local plugin development, load the package through a `file://` plugin entry or copy `dist/index.js` into `.opencode/plugins/` for rapid iteration.

## Debugging

The plugin writes buffered logs to `/tmp/oc-blackbytes.log`. Inspect this file for config resolution, model fallback decisions, MCP provisioning, and tool registration details.

```bash
# View OpenCode logs with debug verbosity
opencode --print-logs --log-level DEBUG

# View plugin-specific logs
cat /tmp/oc-blackbytes.log

# Watch logs in real time
tail -f /tmp/oc-blackbytes.log

# Inspect the resolved OpenCode config (includes merged agents, MCPs, and commands)
opencode debug config
```

## Project structure

```text
oc-blackbytes/
├── src/
│   ├── index.ts
│   ├── bootstrap.ts
│   ├── config/
│   ├── handlers/
│   ├── extensions/
│   │   ├── agents/
│   │   ├── commands/
│   │   ├── hooks/
│   │   ├── mcp/
│   │   ├── skills/
│   │   └── tools/
│   ├── services/
│   ├── shared/
│   ├── compat/
│   ├── integrations/
│   └── stores/
├── docs/
│   └── configuration.md
├── test/
│   ├── config.test.ts
│   ├── agent-config.test.ts
│   ├── mcp-config.test.ts
│   ├── handlers.test.ts
│   ├── workspace-boundary.test.ts
│   └── model-resolver.test.ts
├── dist/
├── AGENTS.md
├── CHANGELOG.md
└── package.json
```

`dist/` is a build artifact and is generated by `bun run build`.

## Publishing

```bash
bun run build
npm publish
```

## License

MIT
