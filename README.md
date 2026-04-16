# oc-blackbytes

An OpenCode plugin for workflow automation. It provisions built-in MCP servers, installs a primary agent and specialized subagents, exposes local search/editing tools, injects provider-specific chat headers, and loads plugin configuration from JSONC.

## What the plugin provides

The plugin wires five OpenCode hook surfaces:

- `config` — merges built-in MCP servers, agents, and commands into the active OpenCode config
- `chat.headers` — injects `x-initiator: agent` for supported GitHub Copilot providers
- `tool` — registers bundled local tools for structured editing and codebase search
- `tool.execute.after` — post-processes `read`/`write` output when hashline editing is enabled
- `chat.params` — adapts model parameters at runtime based on actual model family and agent role

## Features

- **Built-in MCP provisioning** — configures `websearch`, `context7`, and `grep_app`
- **Agent installation** — provides `bytes` as the default primary agent plus `explore`, `oracle`, `librarian`, and `general`
- **Per-agent model configuration** — each agent can target a specific model with tailored reasoning effort, temperature, and fallback chains via the `agents` config field
- **Runtime model parameter adaptation** — the `chat.params` hook detects the actual model family at inference time and applies provider-correct parameters (Claude thinking, OpenAI reasoning effort) while stripping incompatible options
- **Local tool registration** — exposes `hashline_edit`, `ast_grep_search`, `ast_grep_replace`, `grep`, and `glob`
- **Hashline editing workflow** — transforms `read` output into `LINE#ID` anchors and turns successful `write` output into concise line-count summaries
- **Config merging pipeline** — merges built-in MCPs, agents, and commands with user-defined config while preserving explicit user disables
- **Built-in commands** — provides `/setup-models` for interactive model configuration setup
- **JSONC config loading** — reads `oc-blackbytes.json` or `oc-blackbytes.jsonc` with comments and trailing commas
- **Structured logging** — buffers plugin logs to `/tmp/oc-blackbytes.log`
- **Binary auto-installation** — downloads cached search binaries when needed for bundled tools
- **Language matching** — agents detect the user's language and respond in the same language while keeping code, technical terms, file paths, tool names, and git messages in English
- **Question permission** — the primary agent (`bytes`) can ask users clarifying questions when a task is ambiguous
- **Runtime context injection** — each agent's prompt includes an `<available_resources>` section reflecting the actual enabled tools, MCP servers, and peer agents at runtime

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

### From local development

Point OpenCode at the local package directory:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/oc-blackbytes"]
}
```

Build the plugin, then verify the resolved config:

```bash
bun run build
opencode debug config
```

## Configuration

Create `oc-blackbytes.jsonc` in the OpenCode config directory. For the full configuration guide with recommended models per agent and example setups, see [docs/configuration.md](docs/configuration.md).

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  "disabled_mcps": ["grep_app"],
  "disabled_agents": ["oracle"],
  "disabled_tools": ["ast_grep_replace"],

  "hashline_edit": true,

  "websearch": {
    "provider": "exa"
  },

  "agents": {
    "oracle": { "model": "openai/gpt-5.4", "reasoningEffort": "high" },
    "explore": { "model": "google/gemini-3-flash", "temperature": 0.1 },
    "librarian": { "model": "minimax/minimax-m2.7" },
    "general": { "model": "anthropic/claude-sonnet-4-6" }
  }
}
```

### Active options

| Option | Type | Default | Description |
|---|---|---|---|
| `disabled_mcps` | `string[]` | `[]` | Removes built-in MCP entries by name after merge. |
| `disabled_agents` | `string[]` | `[]` | Removes built-in or merged agent entries by name. |
| `disabled_hooks` | `string[]` | `[]` | Recognized by the schema for hook-level control workflows. |
| `disabled_tools` | `string[]` | `[]` | Prevents bundled tools from being registered. |
| `mcp_env_alllowlist` | `string[]` | `[]` | Recognized by the schema for MCP environment filtering workflows. |
| `hashline_edit` | `boolean` | `true` | Enables the `hashline_edit` tool and `tool.execute.after` hashline post-processing for `read`/`write`. |
| `model_fallback` | `boolean` | `false` | Enables model fallback resolution: discovers connected providers at init and resolves fallback chains when a preferred model's provider is unavailable. Set to `true` to enable. |
| `auto_update` | `boolean` | `false` | Recognized by the schema for maintenance workflows. |
| `websearch.provider` | `"exa" \| "tavily"` | `"exa"` | Selects the built-in `websearch` MCP backend. |
| `agents` | `Record<string, AgentModelConfig>` | `{}` | Per-agent model configuration overrides. See [Per-agent model configuration](#per-agent-model-configuration). |
| `fallback_models` | `string \| (string \| FallbackModelObject)[]` | — | Global fallback model chain. When an agent's primary model is unavailable, the plugin walks this chain and uses the first model whose provider is connected. |
| `_migrations` | `string[]` | `[]` | Internal migration bookkeeping. |

## Built-in agents

The plugin merges these agents into the OpenCode config and sets `default_agent` to `bytes` when no default is already configured. Each agent's prompt is appended with an `<available_resources>` section at config time, reflecting the final runtime state of enabled tools, MCP servers, and peer agents. The `bytes` agent has `question: "allow"` permission, enabling it to ask clarifying questions when a task is ambiguous.

| Agent | Mode | Purpose |
|---|---|---|
| `bytes` | Primary | End-to-end coding agent for implementation, debugging, refactoring, planning, and review. Respects the model selected in the OpenCode UI. |
| `explore` | Subagent | Read-only codebase search specialist for broad, parallel discovery. |
| `oracle` | Subagent | Read-only high-reasoning advisor for architecture, debugging escalation, and self-review. |
| `librarian` | Subagent | Read-only research agent for external libraries, remote repositories, docs, and implementation examples. |
| `general` | Subagent | Write-capable execution agent for multi-file implementation, migrations, and cross-layer changes. |

The merge behavior also preserves explicit user disables (`disable: true`), removes entries listed in `disabled_agents`, uses the OpenCode `permission` map format, and marks OpenCode's default `build` and `plan` agents as disabled unless the user configures them directly.

### Agent runtime context

Each enabled agent's prompt is appended with an `<available_resources>` section at config time. This section reflects the final runtime state after all merging and disabling:

- **Bundled tools** — lists enabled tools (filtered by `disabled_tools` and `hashline_edit` config)
- **MCP servers** — lists active MCP servers with descriptions for built-in MCPs; user-added MCPs also appear
- **Peer agents** — each agent sees all other enabled agents with their descriptions (but not itself)

If an MCP is disabled or a tool is removed via config, agents automatically stop seeing it in their prompts. User-added MCPs and agents also appear in the runtime context.

## Built-in commands

The plugin registers these built-in slash commands into the OpenCode config:

| Command | Description |
|---|---|
| `/setup-models` | Interactive wizard that discovers available models, recommends optimal assignments per agent role, and writes the configuration to `oc-blackbytes.jsonc`. |

### Per-agent model configuration

The `agents` field accepts a record of agent names to model configuration objects:

```jsonc
{
  "agents": {
    "oracle": {
      "model": "openai/gpt-5.4",
      "reasoningEffort": "high"
    },
    "explore": {
      "model": "google/gemini-3-flash",
      "temperature": 0.1
    },
    "librarian": {
      "model": "minimax/minimax-m2.7"
    },
    "general": {
      "model": "anthropic/claude-sonnet-4-6"
    }
  }
}
```

Each agent model config supports:

| Field | Type | Description |
|---|---|---|
| `model` | `string` | Model identifier (e.g., `"openai/gpt-5.4"`). Drives prompt variant selection and, for subagents, sets the model hint. |
| `reasoningEffort` | `string` | Override reasoning effort level for OpenAI reasoning models (`"low"`, `"medium"`, `"high"`). |
| `temperature` | `number` | Override temperature for the agent. |
| `fallback_models` | `string \| (string \| object)[]` | Per-agent fallback chain — tried before the global `fallback_models` when the primary model's provider is unavailable. |

When a `model` is specified for a subagent, the factory selects the appropriate prompt variant for that model family (Claude, GPT, or Gemini). The primary agent (`bytes`) uses the model hint for prompt selection only — the actual model is determined by the OpenCode UI selection. For recommended models per agent, see [docs/configuration.md](docs/configuration.md).

## Runtime model parameter adaptation

The `chat.params` hook fires on every LLM call and applies provider-correct parameters based on the actual runtime model:

| Model Family | Behavior |
|---|---|
| **Claude** (Anthropic) | Applies extended thinking with per-agent budget tokens (bytes: 32K, oracle: 32K, general: 16K) when the model supports reasoning. Strips `reasoningEffort` and `textVerbosity`. |
| **GPT** (OpenAI) | Applies `reasoningEffort` per agent (oracle: `"high"`, bytes/general: `"medium"`) when the model supports reasoning. Strips `thinking`. |
| **Gemini / Other** | Strips all provider-specific options (`thinking`, `reasoningEffort`, `textVerbosity`). |

User overrides from the `agents` config take priority over these defaults. Agents without thinking defaults (`explore`, `librarian`) skip reasoning configuration for speed and cost efficiency.

## Built-in MCP servers

| Server | Auth | Behavior |
|---|---|---|
| `websearch` (`exa`) | Optional `EXA_API_KEY` | Uses Exa MCP with `web_search_exa`. Works without a key; authenticated requests append the API key to the MCP URL. |
| `websearch` (`tavily`) | Required `TAVILY_API_KEY` | Uses Tavily MCP with bearer auth. The MCP entry is omitted when the key is missing. |
| `context7` | Optional `CONTEXT7_API_KEY` | Uses Context7 MCP with optional bearer auth. |
| `grep_app` | None | Uses the hosted grep.app MCP endpoint. |

## Bundled tools

| Tool | Purpose | Notes |
|---|---|---|
| `hashline_edit` | Precise file edits anchored by `LINE#ID` tokens | Intended to be paired with `read` output transformed by `tool.execute.after`. Supports replace/append/prepend, rename, delete, and missing-file creation flows. |
| `ast_grep_search` | AST-aware structural search | Supports 25 languages, meta-variables like `$VAR`/`$$$`, and optional path/glob filtering. |
| `ast_grep_replace` | AST-aware structural rewrite | Dry-run by default; applies rewrites when `dryRun: false`. |
| `grep` | Regex content search | Supports `content`, `files_with_matches`, and `count` output modes plus include filters and output limits. |
| `glob` | Fast file pattern search | Returns matching file paths sorted by modification time. |

### Tool arguments

#### `hashline_edit`

```json
{
  "filePath": "src/file.ts",
  "delete": false,
  "rename": "src/file-renamed.ts",
  "edits": [
    {
      "op": "replace",
      "pos": "LINE#ABC123",
      "end": "LINE#DEF456",
      "lines": ["replacement text"]
    }
  ]
}
```

- Supported edit operations: `replace`, `append`, `prepend`
- Anchors use exact `LINE#ID` tags from transformed `read` output
- `lines: []` or `lines: null` with `replace` deletes the targeted lines
- `delete: true` deletes the file
- `rename` renames the file as part of the same operation

#### `ast_grep_search`

| Argument | Required | Description |
|---|---|---|
| `pattern` | Yes | Structural match pattern. |
| `lang` | Yes | ast-grep language identifier. |
| `paths` | No | Explicit file or directory paths to search. |
| `globs` | No | Glob filters applied within the search. |
| `context` | No | Context lines included around each match. |

#### `ast_grep_replace`

| Argument | Required | Description |
|---|---|---|
| `pattern` | Yes | Structural match pattern. |
| `rewrite` | Yes | Rewrite template. |
| `lang` | Yes | ast-grep language identifier. |
| `paths` | No | Explicit file or directory paths to update. |
| `globs` | No | Glob filters applied within the update set. |
| `dryRun` | No | Defaults to `true`; set to `false` to apply changes. |

#### `grep`

| Argument | Required | Description |
|---|---|---|
| `pattern` | Yes | Regex search pattern. |
| `include` | No | File include glob such as `*.ts`. |
| `path` | No | Search root relative to the runtime directory. |
| `output_mode` | No | `content`, `files_with_matches`, or `count`. Defaults to `files_with_matches`. |
| `head_limit` | No | Maximum number of result lines returned. |

#### `glob`

| Argument | Required | Description |
|---|---|---|
| `pattern` | Yes | Glob pattern to match. |
| `path` | No | Search root relative to the runtime directory. |

### Tool runtime behavior

- `grep` and `glob` prefer ripgrep, fall back to system `grep` when necessary, and auto-install ripgrep into the plugin cache when no suitable binary is available.
- `ast_grep_search` and `ast_grep_replace` download the `sg` CLI into the same cache when it is not already available.
- Cached binaries live under the platform cache directory for `oc-blackbytes`:
  - macOS: `~/Library/Caches/oc-blackbytes`
  - Linux: `${XDG_CACHE_HOME:-~/.cache}/oc-blackbytes`
  - Windows: `%LOCALAPPDATA%\oc-blackbytes`

## Chat header behavior

For `github-copilot` and `github-copilot-enterprise` providers, the plugin injects:

```http
x-initiator: agent
```

This header is skipped for the `@ai-sdk/github-copilot` API integration path.

## Configuration file discovery

The plugin resolves its config from the active OpenCode config directory and looks for:

- `oc-blackbytes.jsonc`
- `oc-blackbytes.json`

For CLI usage, `OPENCODE_CONFIG_DIR` overrides the default OpenCode config directory. Desktop builds use the appropriate Tauri config directories (`ai.opencode.desktop` and `ai.opencode.desktop.dev`) and fall back to the CLI config location when an existing CLI config is present.

## Environment variables

| Variable | Required | Effect |
|---|---|---|
| `EXA_API_KEY` | No | Enables authenticated Exa websearch MCP requests. |
| `TAVILY_API_KEY` | Yes, when `websearch.provider` is `tavily` | Enables the Tavily websearch MCP. |
| `CONTEXT7_API_KEY` | No | Adds bearer auth to the Context7 MCP. |
| `OPENCODE_CONFIG_DIR` | No | Overrides the OpenCode config directory used for config discovery. |
| `XDG_CONFIG_HOME` | No | Influences CLI config-directory resolution on Linux and compatible environments. |
| `XDG_CACHE_HOME` | No | Influences plugin binary-cache resolution on Linux and compatible environments. |
| `LOCALAPPDATA` / `APPDATA` | No | Influences cache/config resolution on Windows. |

## Project structure

```text
oc-blackbytes/
├── src/
│   ├── index.ts                    # Plugin entry
│   ├── bootstrap.ts                # Hook assembly (config, chat.headers, chat.params, tool, tool.execute.after)
│   ├── config/                     # JSONC config loading + Zod schemas (including per-agent model config)
│   ├── handlers/                   # Hook handlers for config, tools, chat headers, chat params, and post-processing
│   ├── extensions/
│   │   ├── agents/                 # bytes/explore/oracle/librarian/general agent definitions
│   │   ├── hooks/                  # Hook-related extension helpers
│   │   ├── mcp/                    # Built-in MCP server configs
│   │   ├── skills/                 # Skill extension entrypoints
│   │   ├── commands/              # Built-in slash commands (setup-models)
│   │   └── tools/                  # hashline_edit, ast-grep, grep, glob
│   ├── shared/                     # Logger, constants, config path resolution, JSONC utils
│   ├── compat/                     # Compatibility integrations
│   ├── integrations/               # Additional runtime integrations
│   ├── services/                   # Model fallback resolution (provider discovery, fallback chains)
│   └── stores/                     # Reserved state stores
├── docs/
│   ├── configuration.md
│   └── debugging.md
├── test/
│   └── config.test.ts
├── dist/
│   └── index.js                    # Build output
├── AGENTS.md
├── CHANGELOG.md
└── package.json
```

## Commands

```bash
bun run build       # Compile src/index.ts -> dist/index.js
bun test            # Run bun:test suites
bun run lint        # Run Biome lint checks
bun run format      # Apply Biome formatting
bun run check       # Run Biome check (lint + format verification)
bun run prepublishOnly  # Build before publish
```

## Development workflow

```bash
bun install
bun run build
bun run check
bun test
```

During local plugin development, load the package through a `file://` plugin entry or copy `dist/index.js` into `.opencode/plugins/` for rapid iteration.

## Debugging

See [docs/debugging.md](docs/debugging.md) for the full guide.

Quick reference:

```bash
opencode --print-logs --log-level DEBUG
cat /tmp/oc-blackbytes.log
```

## Publishing

```bash
bun run build
npm publish
```

## License

MIT
