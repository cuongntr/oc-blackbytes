# oc-blackbytes

An OpenCode plugin for workflow automation. It provisions built-in MCP servers, installs a primary agent and specialized subagents, exposes local search/editing tools, injects provider-specific chat headers, and loads plugin configuration from JSONC.

## What the plugin provides

The plugin wires four OpenCode hook surfaces:

- `config` — merges built-in MCP servers and agents into the active OpenCode config
- `chat.headers` — injects `x-initiator: agent` for supported GitHub Copilot providers
- `tool` — registers bundled local tools for structured editing and codebase search
- `tool.execute.after` — post-processes `read`/`write` output when hashline editing is enabled

## Features

- **Built-in MCP provisioning** — configures `websearch`, `context7`, and `grep_app`
- **Agent installation** — provides `bytes` as the default primary agent plus `explore`, `oracle`, and `librarian` subagents
- **Local tool registration** — exposes `hashline_edit`, `ast_grep_search`, `ast_grep_replace`, `grep`, and `glob`
- **Hashline editing workflow** — transforms `read` output into `LINE#ID` anchors and turns successful `write` output into concise line-count summaries
- **Config merging pipeline** — merges built-in MCPs and agents with user-defined config while preserving explicit user disables
- **JSONC config loading** — reads `oc-blackbytes.json` or `oc-blackbytes.jsonc` with comments and trailing commas
- **Structured logging** — buffers plugin logs to `/tmp/oc-blackbytes.log`
- **Binary auto-installation** — downloads cached search binaries when needed for bundled tools

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

Create `oc-blackbytes.jsonc` in the OpenCode config directory.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  "disabled_mcps": ["grep_app"],
  "disabled_agents": ["oracle"],
  "disabled_tools": ["ast_grep_replace"],

  "hashline_edit": true,

  "websearch": {
    "provider": "exa"
  }
}
```

### Active options

| Option | Type | Default | Description |
|---|---|---|---|
| `disabled_mcps` | `string[]` | `[]` | Removes built-in MCP entries by name after merge. |
| `disabled_agents` | `string[]` | `[]` | Removes built-in or merged agent entries by name. |
| `disabled_tools` | `string[]` | `[]` | Prevents bundled tools from being registered. |
| `hashline_edit` | `boolean` | `true` | Enables the `hashline_edit` tool and `tool.execute.after` hashline post-processing for `read`/`write`. |
| `websearch.provider` | `"exa" \| "tavily"` | `"exa"` | Selects the built-in `websearch` MCP backend. |

### Additional recognized keys

These keys are accepted by the config schema and reserved for compatibility or internal workflows:

| Option | Type | Notes |
|---|---|---|
| `disabled_hooks` | `string[]` | Reserved for hook-level control. |
| `mcp_env_alllowlist` | `string[]` | Reserved for MCP environment filtering. |
| `model_fallback` | `boolean` | Reserved for model compatibility behavior. |
| `auto_update` | `boolean` | Reserved for plugin maintenance workflows. |
| `_migrations` | `string[]` | Internal migration bookkeeping. |

## Built-in agents

The plugin merges these agents into the OpenCode config and sets `default_agent` to `bytes` when no default is already configured.

| Agent | Mode | Purpose |
|---|---|---|
| `bytes` | Primary | End-to-end coding agent for implementation, debugging, refactoring, planning, and review. Respects the model selected in the OpenCode UI. |
| `explore` | Subagent | Read-only codebase search specialist for broad, parallel discovery. |
| `oracle` | Subagent | Read-only high-reasoning advisor for architecture, debugging escalation, and self-review. |
| `librarian` | Subagent | Read-only research agent for external libraries, remote repositories, docs, and implementation examples. |

The merge behavior also preserves explicit user disables (`disable: true`) and marks OpenCode's default `build` and `plan` agents as disabled unless the user configures them directly.

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

For CLI usage, `OPENCODE_CONFIG_DIR` overrides the default OpenCode config directory. Desktop builds use the appropriate Tauri config directory and fall back to the CLI config location when an existing CLI config is present.

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
│   ├── bootstrap.ts                # Hook assembly
│   ├── config/                     # JSONC config loading + Zod schemas
│   ├── handlers/                   # Hook handlers for config, tools, chat headers
│   ├── extensions/
│   │   ├── agents/                 # bytes/explore/oracle/librarian agent definitions
│   │   ├── mcp/                    # Built-in MCP server configs
│   │   └── tools/                  # hashline_edit, ast-grep, grep, glob
│   ├── shared/                     # Logger, constants, config path resolution, JSONC utils
│   ├── compat/                     # Compatibility integrations
│   └── integrations/               # Additional runtime integrations
├── docs/
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
