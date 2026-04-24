# Configuration Guide

This guide covers the current `oc-blackbytes.jsonc` configuration surface, agent roles, model assignment strategy, fallback resolution, and practical example setups.

## Table of contents

- [Config file location](#config-file-location)
- [Quick setup with `/setup-models`](#quick-setup-with-setup-models)
- [Quick setup with `/setup-lsp`](#quick-setup-with-setup-lsp)
- [Full config reference](#full-config-reference)
- [Built-in agents](#built-in-agents)
- [Per-agent model configuration](#per-agent-model-configuration)
- [Model recommendations by role](#model-recommendations-by-role)
- [Model fallback resolution](#model-fallback-resolution)
- [Runtime model parameter adaptation](#runtime-model-parameter-adaptation)
- [Built-in MCP servers](#built-in-mcp-servers)
- [Bundled tools](#bundled-tools)
- [OpenCode core LSP facts](#opencode-core-lsp-facts)
- [Example configurations](#example-configurations)
- [Operational notes](#operational-notes)

## Config file location

Create `oc-blackbytes.jsonc` or `oc-blackbytes.json` in the resolved OpenCode config directory.

Resolution behavior:

- CLI defaults to the OpenCode config directory
- `OPENCODE_CONFIG_DIR` overrides the CLI location
- desktop builds use the relevant Tauri config directories
- desktop resolution falls back to the CLI config location when an existing CLI OpenCode config is present

## Quick setup with `/setup-models`

`/setup-models` is the built-in command for generating or updating model assignments.

It:

1. runs `opencode models`
2. checks for an existing `oc-blackbytes.jsonc` or `oc-blackbytes.json`
3. recommends models by agent role
4. writes or merges plugin config in JSONC format

When a config file already exists, the command preserves unrelated fields and merges the generated `agents` and `model_fallback` settings into the existing file.

## Quick setup with `/setup-lsp`

`/setup-lsp` is the built-in command for guided OpenCode core LSP setup. It configures OpenCode itself, not `oc-blackbytes.jsonc`, and it asks for confirmation before editing user config.

It:

1. explains the experimental `OPENCODE_EXPERIMENTAL_LSP_TOOL=true` and `OPENCODE_EXPERIMENTAL=true` flags
2. checks supported OpenCode config files such as `config.json`, `opencode.json`, and `opencode.jsonc`
3. preserves existing `permission`, `lsp`, `agent`, `mcp`, and plugin-related config fields
4. proposes the minimal `permission.lsp = "allow"` setting and optional `lsp` server entries
5. summarizes the edited config file, required restart/env flag, and search/read fallbacks

Use this command when you want an interactive, safety-first setup path. Use the manual [OpenCode core LSP facts](#opencode-core-lsp-facts) section below when you need exact schema details or want to update config yourself.

## Full config reference

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  "disabled_mcps": ["grep_app"],
  "disabled_agents": ["oracle"],
  "disabled_tools": ["ast_grep_replace"],

  "hashline_edit": true,
  "model_fallback": true,

  "websearch": {
    "provider": "exa"
  },

  "agents": {
    "oracle": {
      "model": "openai/gpt-5.4",
      "reasoningEffort": "high",
      "fallback_models": [
        { "model": "anthropic/claude-opus-4-6" },
        { "model": "google/gemini-2.5-pro" }
      ]
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
  },

  "fallback_models": [
    "anthropic/claude-sonnet-4-6",
    { "model": "openai/gpt-4.1", "reasoningEffort": "medium" },
    { "model": "google/gemini-2.5-pro", "temperature": 0.2 }
  ]
}
```

### Top-level options

| Option | Type | Default | Description |
|---|---|---|---|
| `disabled_mcps` | `string[]` | `[]` | Removes MCP entries by name after MCP merge |
| `disabled_agents` | `string[]` | `[]` | Removes merged agent entries by name |
| `disabled_tools` | `string[]` | `[]` | Prevents bundled tools from being registered |
| `hashline_edit` | `boolean` | `true` | Enables `hashline_edit` and the `tool.execute.after` read/write post-processing |
| `model_fallback` | `boolean` | `false` | Enables provider discovery and fallback-chain resolution |
| `websearch.provider` | `"exa" \| "tavily"` | `"exa"` | Selects the built-in `websearch` backend |
| `agents` | `Record<string, AgentModelConfig>` | `{}` | Per-agent model and parameter overrides |
| `fallback_models` | `string \| (string \| FallbackModelObject)[]` | — | Global fallback chain tried after any per-agent fallback chain |

## Built-in agents

The plugin installs these agents into the final OpenCode config:

| Agent | Mode | Role | Notes |
|---|---|---|---|
| `bytes` | Primary | End-to-end coding agent | Respects the model selected in the OpenCode UI |
| `explore` | Subagent | Read-only codebase search | Optimized for fast, parallel discovery |
| `oracle` | Subagent | Read-only reasoning advisor | Used for architecture, hard debugging, and self-review |
| `librarian` | Subagent | Read-only external research | Focused on docs, remote repos, and usage examples |
| `general` | Subagent | Write-capable implementation executor | Best for well-scoped multi-file execution |

Additional merge behavior:

- `default_agent` is set to `bytes` when the user did not already set one
- user-defined agents override built-in agents with the same name
- user agents with `disable: true` stay present but disabled
- names listed in `disabled_agents` are removed after merge
- built-in `build` and `plan` are marked disabled unless configured explicitly by the user

### Runtime resource injection

Each enabled agent prompt is extended with an `<available_resources>` section generated from the final merged runtime state. That section includes:

- enabled bundled tools
- enabled MCP servers
- enabled peer agents

This means config changes affect both actual availability and the resources agents see in their prompts.

## Per-agent model configuration

The `agents` field accepts a record keyed by agent name.

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
    "general": {
      "model": "anthropic/claude-sonnet-4-6",
      "fallback_models": ["openai/gpt-4.1"]
    }
  }
}
```

### Agent model fields

| Field | Type | Description |
|---|---|---|
| `model` | `string` | Model identifier in `provider/model` format |
| `reasoningEffort` | `string` | OpenAI reasoning override such as `low`, `medium`, or `high` |
| `temperature` | `number` | Agent temperature override |
| `fallback_models` | `string \| (string \| object)[]` | Per-agent fallback chain tried before the global chain |

### `bytes` model behavior

`bytes` does not set its runtime model from plugin config. If you set `agents.bytes.model`, it only affects prompt variant selection, not the actual model used for the primary conversation. The actual runtime model still comes from the OpenCode UI or the main OpenCode config.

### Subagent model behavior

For `explore`, `oracle`, `librarian`, and `general`, the configured `model` is passed through as the subagent model hint and runtime assignment target.

## Model recommendations by role

The plugin works with any provider/model pair OpenCode exposes, but the agent roles favor different tradeoffs.

### `bytes`

- leave unconfigured in plugin config in most setups
- choose the primary model in OpenCode UI
- use a strong general-purpose coding model with good reasoning and large context

### `oracle`

- prioritize the strongest reasoning model available
- use a different provider than `bytes` when possible for a true second opinion
- common fit: OpenAI flagship reasoning, Anthropic flagship reasoning, or Gemini Pro-class models

### `explore`

- prioritize speed and low cost
- lower temperature is usually useful for deterministic search behavior
- common fit: flash/mini/nano/haiku-class models with reliable tool calling

### `librarian`

- prioritize fast document reading and summarization
- similar cost/speed profile to `explore`
- common fit: flash/mini/haiku-class models

### `general`

- prioritize solid code generation over premium reasoning
- best used with a strong mid-tier coding model
- common fit: Sonnet-class, GPT mid-tier, Gemini Pro-class, or similarly capable coding models

## Model fallback resolution

`model_fallback` controls provider-aware model resolution. It is disabled by default and only runs when set to `true`.

### What happens when enabled

At startup, the plugin calls `client.provider.list()` and builds a map of connected providers and available models. For each configured agent model, resolution proceeds in this order:

1. primary agent model
2. per-agent `fallback_models`
3. global `fallback_models`
4. OpenCode default behavior if nothing resolves

If provider discovery fails or returns nothing, the plugin skips fallback resolution and uses the static config as-is.

### Fallback chain formats

```jsonc
{
  "fallback_models": "openai/gpt-4.1"
}
```

```jsonc
{
  "fallback_models": [
    "anthropic/claude-sonnet-4-6",
    "google/gemini-2.5-pro"
  ]
}
```

```jsonc
{
  "fallback_models": [
    { "model": "openai/gpt-4.1", "reasoningEffort": "medium" },
    { "model": "google/gemini-2.5-pro", "temperature": 0.2 }
  ]
}
```

### Availability checks

The resolver checks both:

- provider connectivity
- model availability within that provider

Exact model IDs are preferred, and provider-scoped prefix matching allows date-suffixed variants such as `anthropic/claude-sonnet-4-6-20260401` to satisfy `anthropic/claude-sonnet-4-6`.

Models without a provider prefix cannot be validated against provider discovery, so they are treated as available.

### Fallback-specific overrides

When a fallback entry includes `reasoningEffort` or `temperature`, those values apply only when that fallback entry is the model that resolves.

## Runtime model parameter adaptation

The `chat.params` hook runs on every model call and uses the actual runtime model family, not just config-time hints.

| Runtime family | Behavior |
|---|---|
| Claude | Applies `thinking` defaults for `bytes`, `oracle`, and `general` when the model reports reasoning support; strips OpenAI-only options |
| OpenAI | Applies `reasoningEffort` defaults for `bytes`, `oracle`, and `general` when the model reports reasoning support; strips Claude-only options |
| Gemini / other | Strips provider-specific reasoning options |
| `explore` / `librarian` | No default thinking or reasoning config is applied |

### Default runtime behavior

- Claude budgets: `bytes` 32K, `oracle` 32K, `general` 16K
- OpenAI reasoning defaults: `bytes` medium, `oracle` high, `general` medium
- user `temperature` overrides are applied from `agents.<name>.temperature`
- user `reasoningEffort` overrides are applied for OpenAI-family models

## Built-in MCP servers

| Server | Auth | Notes |
|---|---|---|
| `websearch` (`exa`) | Optional `EXA_API_KEY` | Default provider; works without a key |
| `websearch` (`tavily`) | Required `TAVILY_API_KEY` | Omitted entirely when the key is missing |
| `context7` | Optional `CONTEXT7_API_KEY` | Adds bearer auth when present |
| `grep_app` | None | Hosted MCP for GitHub code search |

## Bundled tools

| Tool | Purpose | Notes |
|---|---|---|
| `hashline_edit` | Precise anchored edits | Uses `LINE#ID` anchors derived from `read` output |
| `ast_grep_search` | AST-aware structural search | Requires complete AST-node patterns |
| `ast_grep_replace` | AST-aware structural rewrite | Dry-run unless `dryRun: false` |
| `grep` | Regex content search | Supports `content`, `files_with_matches`, and `count` |
| `glob` | File-name pattern search | Returns matching paths sorted by modification time |

### `hashline_edit`

Typical flow:

1. run `read`
2. copy exact `LINE#ID` anchors
3. issue one `hashline_edit` call per file with batched edits against the same snapshot
4. re-read before another edit call on that file

Key operations:

- `replace`
- `append`
- `prepend`
- optional `rename`
- optional `delete`

### `ast_grep_search` and `ast_grep_replace`

Pattern rules:

- patterns must be valid, complete AST nodes
- `$VAR` matches a single node
- `$$$` matches multiple nodes

Examples:

```text
console.log($MSG)
export async function $NAME($$$) { $$$ }
def $FUNC($$$)
```

Supported languages:

`bash`, `c`, `cpp`, `csharp`, `css`, `elixir`, `go`, `haskell`, `html`, `java`, `javascript`, `json`, `kotlin`, `lua`, `nix`, `php`, `python`, `ruby`, `rust`, `scala`, `solidity`, `swift`, `typescript`, `tsx`, `yaml`

### `grep`

Arguments:

- `pattern` — regex pattern
- `include` — optional file glob filter
- `path` — optional search root
- `output_mode` — `content`, `files_with_matches`, or `count`
- `head_limit` — optional result cap

### `glob`

Arguments:

- `pattern` — required glob pattern
- `path` — optional search root

### Tool runtime behavior

- `grep` and `glob` auto-resolve `rg` and install a cached binary when needed
- `ast_grep_search` and `ast_grep_replace` auto-resolve `sg` and install a cached binary when needed
- cached binaries live under the platform cache directory for `oc-blackbytes`

## OpenCode core LSP facts

Verified on 2026-04-24 against OpenCode source commit [`6c1268f3b18ed289bc524ed10add8c3caa6131d2`](https://github.com/sst/opencode/tree/6c1268f3b18ed289bc524ed10add8c3caa6131d2) and current Context7 docs for `/anomalyco/opencode`. This section records canonical facts for downstream `oc-blackbytes` docs, prompts, and command templates. The `lsp` tool is owned by OpenCode core; it is not an `oc-blackbytes` bundled tool and is not controlled by `disabled_tools`.

### Enabling the core `lsp` tool

OpenCode registers the built-in tool as `lsp` in [`packages/opencode/src/tool/lsp.ts`](https://github.com/sst/opencode/blob/6c1268f3b18ed289bc524ed10add8c3caa6131d2/packages/opencode/src/tool/lsp.ts). It is experimental and is only added to OpenCode's tool registry when either environment flag is truthy:

- `OPENCODE_EXPERIMENTAL_LSP_TOOL=true`
- `OPENCODE_EXPERIMENTAL=true`

Allow the tool in OpenCode config, not in `oc-blackbytes.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "lsp": "allow"
  }
}
```

`OPENCODE_DISABLE_LSP_DOWNLOAD=true` is a separate OpenCode flag that disables automatic LSP server binary downloads; it does not enable or disable the `lsp` tool itself.

Recommended setup path:

1. Choose an OpenCode config file such as `opencode.jsonc`, `opencode.json`, or `config.json`. Do not put core LSP settings in `oc-blackbytes.jsonc`.
2. Set `OPENCODE_EXPERIMENTAL_LSP_TOOL=true` or `OPENCODE_EXPERIMENTAL=true` before starting OpenCode, then restart OpenCode so the process sees the flag.
3. Add `permission.lsp = "allow"` if you want agents to call the core tool without being prompted each time.
4. Add or adjust `lsp` server entries for languages that are not covered by OpenCode's built-in defaults.
5. Keep normal search/read fallbacks available; LSP depends on a working language server for the target file type.

### Tool operations and arguments

The current `lsp` operation enum is:

- `goToDefinition`
- `findReferences`
- `hover`
- `documentSymbol`
- `workspaceSymbol`
- `goToImplementation`
- `prepareCallHierarchy`
- `incomingCalls`
- `outgoingCalls`

All operations share the same required argument schema from [`packages/opencode/src/tool/lsp.ts`](https://github.com/sst/opencode/blob/6c1268f3b18ed289bc524ed10add8c3caa6131d2/packages/opencode/src/tool/lsp.ts):

| Argument | Type | Notes |
|---|---|---|
| `operation` | enum | One of the operation names above |
| `filePath` | string | Absolute path or path relative to the OpenCode instance directory |
| `line` | integer >= 1 | 1-based editor line number |
| `character` | integer >= 1 | 1-based editor character offset |

OpenCode converts `line` and `character` to 0-based positions internally before calling the language server. Even file- or workspace-level operations such as `documentSymbol` and `workspaceSymbol` still require `line` and `character` because the public tool schema requires them.

### OpenCode LSP server config

OpenCode's top-level `lsp` config accepts `false` to disable LSP globally or an object keyed by server name. Custom server entries are defined in [`packages/opencode/src/config/lsp.ts`](https://github.com/sst/opencode/blob/6c1268f3b18ed289bc524ed10add8c3caa6131d2/packages/opencode/src/config/lsp.ts) and support:

| Field | Type | Notes |
|---|---|---|
| `command` | `string[]` | Command and arguments used to start a custom server |
| `extensions` | `string[]` | File extensions handled by the server |
| `disabled` | `boolean` | Disable a configured server |
| `env` | `Record<string, string>` | Environment variables for the server process |
| `initialization` | `Record<string, unknown>` | Server-specific LSP initialize options |

Example OpenCode config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "lsp": {
    "custom-lsp": {
      "command": ["custom-lsp-server", "--stdio"],
      "extensions": [".custom"],
      "env": {
        "CUSTOM_LSP_LOG": "info"
      },
      "initialization": {
        "preferences": {
          "importModuleSpecifierPreference": "relative"
        }
      }
    }
  },
  "permission": {
    "lsp": "allow"
  }
}
```

### OpenCode config file support and precedence

OpenCode parses JSONC for config files. Both `opencode.json` and `opencode.jsonc` are supported:

- Global config is loaded from `config.json`, then `opencode.json`, then `opencode.jsonc`, so global `opencode.jsonc` overrides overlapping global `opencode.json` keys when both exist.
- Project config discovery searches for both `opencode.jsonc` and `opencode.json` while walking up the project tree. The exact same-directory conflict behavior depends on OpenCode's filesystem search helper, so use one format per directory when downstream examples need deterministic behavior.
- `.opencode/` directories load `opencode.json` and then `opencode.jsonc`, so `.opencode/opencode.jsonc` overrides overlapping `.opencode/opencode.json` keys.

### Plugin API boundary

The current OpenCode plugin `Hooks` interface does not expose `lsp.*` hooks for plugins to register LSP servers, intercept LSP calls, or manage LSP lifecycle. `oc-blackbytes` should treat core `lsp` as an ambient OpenCode tool when the user enables it. The plugin can document the OpenCode config and can influence normal OpenCode config through its existing config hook, but this bead intentionally adds no custom LSP client or bundled `lsp` tool.

### Limitations and fallbacks

Core `lsp` is best for semantic questions such as definitions, references, hover/type context, symbols, implementations, and call hierarchy. It is not a replacement for filename searches, text searches, or anchored edits. When the `lsp` tool is unavailable, no server is configured for a file type, a language server returns no useful results, or the workspace is too small for semantic lookup to help, agents should immediately fall back to `glob`, `grep`, `ast_grep_search`, and `read`.

## Example configurations

### Minimal

```jsonc
{
  "hashline_edit": true,
  "websearch": {
    "provider": "exa"
  }
}
```

### Anthropic primary with OpenAI oracle

```jsonc
{
  "agents": {
    "oracle": { "model": "openai/gpt-5.4", "reasoningEffort": "high" },
    "explore": { "model": "anthropic/claude-haiku-3.5", "temperature": 0.1 },
    "librarian": { "model": "anthropic/claude-haiku-3.5" },
    "general": { "model": "anthropic/claude-sonnet-4-6" }
  }
}
```

### OpenAI primary with Anthropic oracle

```jsonc
{
  "agents": {
    "oracle": { "model": "anthropic/claude-opus-4-6" },
    "explore": { "model": "openai/gpt-4.1-mini", "temperature": 0.1 },
    "librarian": { "model": "openai/gpt-4.1-mini" },
    "general": { "model": "openai/gpt-4.1" }
  }
}
```

### Cost-focused multi-provider mix

```jsonc
{
  "agents": {
    "oracle": { "model": "deepseek/deepseek-r1" },
    "explore": { "model": "google/gemini-3-flash", "temperature": 0.1 },
    "librarian": { "model": "google/gemini-3-flash" },
    "general": { "model": "deepseek/deepseek-chat" }
  }
}
```

### With fallback chains

```jsonc
{
  "model_fallback": true,
  "fallback_models": [
    "anthropic/claude-sonnet-4-6",
    "openai/gpt-4.1",
    "google/gemini-2.5-pro"
  ],
  "agents": {
    "oracle": {
      "model": "openai/gpt-5.4",
      "reasoningEffort": "high",
      "fallback_models": [
        { "model": "anthropic/claude-opus-4-6" },
        { "model": "deepseek/deepseek-r1" }
      ]
    },
    "explore": {
      "model": "google/gemini-3-flash",
      "fallback_models": ["openai/gpt-4.1-mini"]
    },
    "librarian": {
      "model": "google/gemini-3-flash",
      "fallback_models": ["openai/gpt-4.1-mini"]
    },
    "general": {
      "model": "anthropic/claude-sonnet-4-6",
      "fallback_models": ["openai/gpt-4.1"]
    }
  }
}
```

## Operational notes

1. Prefer a different provider for `oracle` than for `bytes` when possible.
2. Use fast, inexpensive models for `explore` and `librarian`.
3. Use a solid mid-tier coding model for `general`.
4. Keep `explore` temperature low when you want deterministic search behavior.
5. Configure only the agents that need explicit overrides; the rest can inherit OpenCode defaults.
6. Use `provider/model` identifiers to match OpenCode’s provider list.
7. Enable `model_fallback` when you want automatic failover across connected providers.
8. Remember that agents only see enabled tools, MCPs, and peer agents in their injected runtime context.
