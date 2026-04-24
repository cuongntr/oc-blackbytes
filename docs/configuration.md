# Configuration Guide

This guide covers the current `oc-blackbytes.jsonc` configuration surface, agent roles, model assignment strategy, fallback resolution, and practical example setups.

## Table of contents

- [Config file location](#config-file-location)
- [Quick setup with `/setup-models`](#quick-setup-with-setup-models)
- [Full config reference](#full-config-reference)
- [Built-in agents](#built-in-agents)
- [Per-agent model configuration](#per-agent-model-configuration)
- [Model recommendations by role](#model-recommendations-by-role)
- [Model fallback resolution](#model-fallback-resolution)
- [Runtime model parameter adaptation](#runtime-model-parameter-adaptation)
- [Built-in MCP servers](#built-in-mcp-servers)
- [Bundled tools](#bundled-tools)
- [OpenCode LSP diagnostics](#opencode-lsp-diagnostics)
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
4. review the success output, which includes `Updated` or `Moved`, the number of requested edits, `+A -D` line counts, and a fenced `diff` block capped at 200 lines
5. re-read before another edit call on that file

Key operations:

- `replace`
- `append`
- `prepend`
- optional `rename`
- optional `delete`

Successful edit output is Markdown-friendly and remains readable as plain text. Large diffs include a truncation note pointing to `git diff -- <path>` for the full file diff.
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

## OpenCode LSP diagnostics

OpenCode can surface LSP diagnostics such as linting and typechecking messages through supported tool output and, when available in the OpenCode runtime, a dedicated `diagnostics` tool. `oc-blackbytes` does not register bundled LSP tools, does not manage language-server lifecycle, and does not control diagnostics through `disabled_tools`.

Agents use `glob`, `grep`, `ast_grep_search`, `read`, and subagents for code discovery. LSP diagnostics are treated as verification signals for errors and warnings rather than as the primary navigation mechanism.

Diagnostics guidance for agents:

1. Use LSP diagnostics when available to check errors and warnings after reading or modifying files.
2. Fix diagnostics caused by the agent's own changes.
3. Ignore diagnostics from unrelated files, or pre-existing issues unrelated to the task, unless the user explicitly asks for broader cleanup.
4. Fall back to normal verification commands such as type checks, lint, tests, and builds for final validation.

If a project needs custom language-server configuration, configure it in OpenCode's own config files, not in `oc-blackbytes.jsonc`.

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
