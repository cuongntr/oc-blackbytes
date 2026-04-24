# oc-blackbytes

OpenCode plugin for workflow automation. It provisions built-in MCP servers, installs a primary agent plus specialized subagents, registers local search and editing tools, provides the `/setup-models` and `/review` commands, adapts model parameters at runtime, injects compatible chat headers, and loads plugin configuration from JSONC.

## What the plugin does

The plugin wires these OpenCode hook surfaces:

- `config` — merges built-in MCP servers, agents, and commands into the active OpenCode config
- `chat.headers` — injects `x-initiator: agent` for supported GitHub Copilot providers
- `chat.params` — adapts provider-specific model parameters from the actual runtime model family and agent role
- `tool` — registers bundled local tools for structural search, regex search, globbing, and anchored editing
- `tool.execute.after` — rewrites `read` output into `LINE#ID` anchors and normalizes successful `write` output when hashline editing is enabled

## Features

- **Built-in MCP provisioning** — `websearch`, `context7`, and `grep_app`
- **Built-in agents** — `bytes`, `explore`, `oracle`, `librarian`, `general`, and `reviewer`
- **Built-in commands** — `/setup-models` for guided agent model assignments and `/review` for read-only code review
- **Per-agent model overrides** — configure `model`, `reasoningEffort`, `temperature`, and `fallback_models`
- **Provider-aware fallback resolution** — discover connected providers and resolve fallback chains when `model_fallback` is enabled
- **Runtime model parameter adaptation** — Claude thinking, OpenAI reasoning effort, and provider-option stripping happen automatically from the runtime model family
- **Bundled tools** — `hashline_edit`, `ast_grep_search`, `ast_grep_replace`, `grep`, and `glob`
- **Hashline editing workflow** — `read` output becomes `LINE#ID|content`, `hashline_edit` applies anchored edits, and successful edit/delete results use Markdown-friendly workspace-relative paths with bounded fenced `diff` blocks for changed content
- **Dynamic agent resource injection** — every enabled agent prompt gets an `<available_resources>` section describing oc-blackbytes-managed bundled tools, MCPs, and peer agents without implying a complete OpenCode runtime inventory
- **JSONC config loading** — supports comments and trailing commas in `oc-blackbytes.jsonc`
- **Structured logging** — writes buffered logs to `/tmp/oc-blackbytes.log`
- **Binary auto-installation** — caches `rg` and `sg` automatically for bundled search tools
- **Language matching** — agents respond in the user’s language while keeping code, technical terms, file paths, tool names, and git messages in English
- **Clarifying questions** — `bytes` has question permission and can ask focused follow-ups when a task is ambiguous
- **OpenCode LSP diagnostics guidance** — Bytes and General fix diagnostics caused by their changes, while Explore treats diagnostics as secondary findings and uses bundled search/read tools for discovery

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
    "general": { "model": "anthropic/claude-sonnet-4-6" },
    "reviewer": { "model": "anthropic/claude-sonnet-4-6", "temperature": 0.1 }
  },

  "fallback_models": [
    "anthropic/claude-sonnet-4-6",
    { "model": "openai/gpt-4.1", "reasoningEffort": "medium" }
  ]
}
```

For the full configuration guide, see [docs/configuration.md](docs/configuration.md).

### Built-in setup command

Use `/setup-models` to generate or update `oc-blackbytes.jsonc` model assignments for `oracle`, `explore`, `librarian`, `general`, and `reviewer`. The command discovers available OpenCode models, recommends role-appropriate assignments, and preserves unrelated plugin config fields when merging changes.

### Built-in review command

Use `/review` to review uncommitted changes, a commit, a branch, or a PR. The command runs as a subtask pinned to the read-only `reviewer` subagent, reads full-file context around changes, and reports concrete findings without modifying files.

```text
/review                 # review unstaged, staged, and untracked changes
/review <commit-sha>    # review a commit
/review <branch-name>   # review changes from branch...HEAD
/review <pr-number>     # review a GitHub PR
```

## Built-in agents

The plugin sets `default_agent` to `bytes` when the user has not already chosen a default. Built-in `build` and `plan` are marked disabled unless the user configures them explicitly.

| Agent | Mode | Purpose |
|---|---|---|
| `bytes` | Primary | End-to-end coding agent for implementation, debugging, planning, review, and delegation |
| `explore` | Subagent | Read-only codebase search specialist for broad discovery |
| `oracle` | Subagent | Read-only high-reasoning advisor for architecture, debugging escalation, and deep design review |
| `librarian` | Subagent | Read-only research agent for external docs, remote repositories, and library usage examples |
| `general` | Subagent | Write-capable executor for multi-file implementation, migrations, and scoped refactors |
| `reviewer` | Subagent | Read-only code reviewer for uncommitted changes, commits, branches, and PRs |

### Runtime agent context

Each enabled agent prompt is extended with an `<available_resources>` section assembled from the final merged config. That section includes:

- enabled bundled tools
- enabled MCP servers
- enabled peer agents

Disabling a built-in MCP or bundled tool automatically removes it from agent prompts as well as from runtime registration.

The runtime resource section describes resources managed by `oc-blackbytes`. OpenCode LSP diagnostics are governed by the OpenCode runtime and configured language servers rather than by `disabled_tools`.

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
3. successful `hashline_edit` output includes a Markdown-friendly summary with workspace-relative paths, the number of requested edits, addition/removal counts, and a fenced `diff` block capped at 200 lines
4. delete mode returns a compact Markdown-friendly confirmation such as ``Deleted `path/to/file.ts` ``
5. successful `write` output is replaced with `File written successfully. N lines written.`

This keeps editing precise, compact, reviewable, and safe across repeated changes.

## OpenCode LSP diagnostics

OpenCode may surface LSP diagnostics such as linting and typechecking messages in tool output, or through a dedicated `diagnostics` tool when its runtime exposes one. `oc-blackbytes` does not register bundled LSP tools or manage language-server lifecycle.

Agent guidance is diagnostics-first: fix diagnostics caused by the agent's own changes, ignore unrelated diagnostics unless the user explicitly asks, and use `glob`, `grep`, `ast_grep_search`, `read`, and subagents for code discovery. Experimental semantic `lsp` operations are not a primary workflow.

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
| OpenCode LSP diagnostics | OpenCode runtime + LSP server config | Not a plugin option | Diagnostics may appear in supported tool output or a core `diagnostics` tool; not affected by `disabled_tools` |
| `fallback_models` | `string \| (string \| object)[]` | — | Global fallback chain tried after a per-agent chain |

See [docs/configuration.md](docs/configuration.md) for full examples, model recommendations, and fallback behavior.

## Runtime model behavior

The `chat.params` hook uses the actual runtime model, not just the configured hint.

- **Claude** — applies thinking budgets for `bytes`, `oracle`, and `general` when reasoning is supported
- **OpenAI** — applies reasoning effort defaults for `bytes`, `oracle`, and `general` when reasoning is supported
- **Gemini / other providers** — strips provider-specific options that do not apply
- **`explore`, `librarian`, and `reviewer`** — skip default reasoning/thinking configuration for speed and deterministic review

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

Releases are published from GitHub Releases. Publishing a release triggers `.github/workflows/publish.yml`, which installs dependencies, runs checks and tests, builds `dist/index.js`, and publishes the package to npm with provenance.

```bash
bun run check
bun run build
git tag v0.8.4
git push origin v0.8.4
gh release create v0.8.4 --title "v0.8.4" --notes-file <release-notes.md>
```

## License

MIT
