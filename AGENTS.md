# AGENTS.md — oc-blackbytes

## Project

OpenCode plugin for workflow automation. Provides built-in MCP server provisioning, built-in agents, the `/setup-models` setup command, bundled local tools, OpenCode LSP diagnostics guidance, chat header injection for compatible providers, hashline post-processing and diff summaries for structured editing, config management via JSONC, and structured file logging.

- **Entry point:** `src/index.ts` → `dist/index.js`
- **Runtime:** Bun (build, test, runtime)
- **Schema validation:** Zod v4
- **Config format:** JSONC (JSON with comments, via `jsonc-parser`)

## Commands

```
bun test          # run tests
bun run build     # compile src/index.ts → dist/index.js
bun run check     # Biome check + unit tests + e2e tests
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
- **`extensions/agents/`** — Factory for built-in agents: `bytes`, `explore`, `oracle`, `librarian`, and `general`, including model-aware prompt selection, language matching (all agents detect user language and respond in kind), OpenCode LSP diagnostics guidance, and OpenCode `permission` map generation. After config merging, each agent's prompt is appended with an `<available_resources>` section listing oc-blackbytes-managed enabled tools, MCP servers, and peer agents.
- **`extensions/tools/`** — Tool definitions for hashline editing, AST-aware search/replace, regex search, and glob search.
- **`extensions/commands/`** — Definitions for built-in slash commands: `/setup-models` for plugin model assignment. Each command specifies a template, description, and optional agent/model binding.

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
- Tests use `bun:test`. Test suites live under `test/` and include agent, handler, MCP, tool, config, and e2e coverage. Uses temp dirs and `OPENCODE_CONFIG_DIR` env override for isolation.
- `dist/` is a build artifact — do not edit directly.
- Built-in MCPs: `websearch`, `context7`, `grep_app`.
- Built-in agents: `bytes`, `explore`, `oracle`, `librarian`, `general`.
- Bundled tools: `hashline_edit`, `ast_grep_search`, `ast_grep_replace`, `grep`, `glob`.
- `hashline_edit` success output includes a Markdown-friendly edit summary, workspace-relative display paths, addition/removal counts, and a bounded fenced `diff` block for review; delete mode returns a compact Markdown-friendly confirmation.
- Built-in commands: `setup-models`.
- OpenCode LSP diagnostics may appear in supported tool output or a core `diagnostics` tool when OpenCode is configured for LSP. Prompt guidance is diagnostics-first: fix diagnostics caused by the agent's changes and use bundled search/read tools for discovery instead of relying on experimental semantic `lsp` operations.
- Language matching is built into every agent's prompt: agents detect the user's language and respond in the same language; code, technical terms, file paths, tool names, and git messages remain in English.
- The `bytes` agent has `question: "allow"` permission, enabling it to ask clarifying questions via OpenCode's built-in question tool when a task is ambiguous.

<!-- bv-agent-instructions-v2 -->

---

## Beads Workflow Integration

This project uses [beads_rust](https://github.com/Dicklesworthstone/beads_rust) (`br`) for issue tracking and [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) (`bv`) for graph-aware triage. Issues are stored in `.beads/` and tracked in git.

### Using bv as an AI sidecar

bv is a graph-aware triage engine for Beads projects (.beads/beads.jsonl). Instead of parsing JSONL or hallucinating graph traversal, use robot flags for deterministic, dependency-aware outputs with precomputed metrics (PageRank, betweenness, critical path, cycles, HITS, eigenvector, k-core).

**Scope boundary:** bv handles *what to work on* (triage, priority, planning). `br` handles creating, modifying, and closing beads.

**CRITICAL: Use ONLY --robot-* flags. Bare bv launches an interactive TUI that blocks your session.**

#### The Workflow: Start With Triage

**`bv --robot-triage` is your single entry point.** It returns everything you need in one call:
- `quick_ref`: at-a-glance counts + top 3 picks
- `recommendations`: ranked actionable items with scores, reasons, unblock info
- `quick_wins`: low-effort high-impact items
- `blockers_to_clear`: items that unblock the most downstream work
- `project_health`: status/type/priority distributions, graph metrics
- `commands`: copy-paste shell commands for next steps

```bash
bv --robot-triage        # THE MEGA-COMMAND: start here
bv --robot-next          # Minimal: just the single top pick + claim command

# Token-optimized output (TOON) for lower LLM context usage:
bv --robot-triage --format toon
```

#### Other bv Commands

| Command | Returns |
|---------|---------|
| `--robot-plan` | Parallel execution tracks with unblocks lists |
| `--robot-priority` | Priority misalignment detection with confidence |
| `--robot-insights` | Full metrics: PageRank, betweenness, HITS, eigenvector, critical path, cycles, k-core |
| `--robot-alerts` | Stale issues, blocking cascades, priority mismatches |
| `--robot-suggest` | Hygiene: duplicates, missing deps, label suggestions, cycle breaks |
| `--robot-diff --diff-since <ref>` | Changes since ref: new/closed/modified issues |
| `--robot-graph [--graph-format=json\|dot\|mermaid]` | Dependency graph export |

#### Scoping & Filtering

```bash
bv --robot-plan --label backend              # Scope to label's subgraph
bv --robot-insights --as-of HEAD~30          # Historical point-in-time
bv --recipe actionable --robot-plan          # Pre-filter: ready to work (no blockers)
bv --recipe high-impact --robot-triage       # Pre-filter: top PageRank scores
```

### br Commands for Issue Management

```bash
br ready              # Show issues ready to work (no blockers)
br list --status=open # All open issues
br show <id>          # Full issue details with dependencies
br create --title="..." --type=task --priority=2
br update <id> --status=in_progress
br close <id> --reason="Completed"
br close <id1> <id2>  # Close multiple issues at once
br sync --flush-only  # Export DB to JSONL
```

### Workflow Pattern

1. **Triage**: Run `bv --robot-triage` to find the highest-impact actionable work
2. **Claim**: Use `br update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `br close <id>`
5. **Sync**: Always run `br sync --flush-only` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers 0-4, not words)
- **Types**: task, bug, feature, epic, chore, docs, question
- **Blocking**: `br dep add <issue> <depends-on>` to add dependencies

### Session Protocol

```bash
git status              # Check what changed
git add <files>         # Stage code changes
br sync --flush-only    # Export beads changes to JSONL
git commit -m "..."     # Commit everything
git push                # Push to remote
```

<!-- end-bv-agent-instructions -->
