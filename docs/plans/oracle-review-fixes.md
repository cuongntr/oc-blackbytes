# Oracle Review Fixes — Execution Plan

## 1. Executive Intent

The Oracle code review of oc-blackbytes identified correctness bugs, security gaps, dead code, and missing test coverage across the plugin. This plan addresses all findings systematically.

**Core outcomes:**
- Bundled tools enforce workspace boundaries — no reads/writes outside the project directory
- Glob fallback works correctly on machines without `rg`
- Config loading surfaces errors visibly and respects desktop/Tauri runtime context
- Prompt injection is idempotent and conditional on actual tool availability
- Dead schema fields and unused code are removed
- Test coverage covers the critical hook and handler paths

**Non-goals:**
- Rewriting the agent prompt system (maintainability noted but not in scope)
- Switching read-only agents from denylist to allowlist permissions (deferred — requires careful evaluation of OpenCode runtime behavior)
- Adding checksum verification for binary downloads (deferred — low immediate risk with pinned versions)
- Moving model discovery off the init path (deferred — requires OpenCode plugin API changes)

**Success looks like:**
- All P0 and P1 bugs are fixed with regression tests
- Dead code is removed cleanly without breaking existing configs
- `bun test` passes, `bun run check` passes, `bun run build` succeeds

## 2. Scope Framing

**In scope:**
- P0: Workspace boundary enforcement for grep, glob, hashline_edit, ast-grep tools
- P0: Fix glob non-rg Unix fallback bug
- P0: Config loading — surface errors, fix desktop config dir resolution
- P1: Idempotent runtime context injection
- P1: Conditional hashline-edit prompt inclusion
- P1: Remove dead schema fields and unused compatibility code
- P1: Fix line count off-by-one in tool-execute-after-handler
- P2: Add tests for agent merging, MCP config, chat.params, tool.execute.after

**Explicitly deferred:**
- Permission model migration (denylist → allowlist) — needs broader evaluation
- Binary download checksum verification — low risk with pinned versions
- Model discovery startup latency — requires plugin API evolution
- Prompt system consolidation — maintainability concern, not a bug

**Assumptions:**
- OpenCode runtime does NOT sandbox tool paths (we must enforce boundaries ourselves)
- Config hook runs exactly once per session (but we make injection idempotent anyway)
- The `_input` parameter in `loadPluginConfig` carries meaningful runtime context (client type)
- Removing dead schema fields with `z.never()` or deletion won't break existing user configs (Zod passthrough handles unknown fields)

## 3. Delivery-Relevant System Understanding

### Components affected

| Component | File(s) | Role |
|-----------|---------|------|
| Workspace boundary | `grep/tools.ts`, `glob/tools.ts`, `hashline-edit/hashline-edit-executor.ts`, `hashline-edit/tools.ts`, `ast-grep/search.ts`, `ast-grep/replace.ts` | Tool path resolution and execution |
| Glob CLI | `glob/cli.ts`, `glob/constants.ts` | File pattern matching with rg/find/PowerShell backends |
| Config loader | `config/loader.ts`, `shared/opencode/opencode-config-dir.ts` | Plugin config discovery and validation |
| Runtime context | `extensions/agents/utils/runtime-context.ts`, `handlers/config-handler/agent-config-handler.ts` | Prompt injection with available resources |
| Agent prompts | `extensions/agents/bytes/default.ts`, `bytes/gpt.ts`, `bytes/gemini.ts` | Hashline-edit workflow instructions |
| Config schema | `config/schema/oc-blackbytes-config.ts` | Dead field definitions |
| Permission compat | `extensions/agents/utils/permission-compat.ts` | Unused migration/allowlist helpers |
| Tool post-processor | `handlers/tool-execute-after-handler.ts` | Line count computation |

### Trust boundaries
- **Tool execution boundary**: Bundled tools receive user-agent-supplied paths. These paths currently have no validation against the workspace root. The workspace root (`directory`) is available in the tool execution context.
- **Config trust**: Plugin config is user-authored JSONC. Schema validation via Zod provides type safety but unknown fields pass through silently.

### Key constraints
- Tools receive `directory` (workspace root) at registration time via closure
- `hashline_edit` receives `filePath` and `rename` as absolute paths from the agent
- Glob/grep receive relative or absolute `path` argument resolved against `directory`
- Config dir resolution depends on detecting the binary type (CLI vs desktop)

## 4. Workstream Decomposition

### WS1: Workspace Boundary Enforcement
**Purpose:** Prevent bundled tools from reading/writing outside the project directory.

- A shared `assertWithinWorkspace(resolvedPath, workspaceRoot)` utility
- Integration into `grep/tools.ts`, `glob/tools.ts`, `hashline-edit/hashline-edit-executor.ts`, `ast-grep/search.ts`, `ast-grep/replace.ts`
- Validation of both `filePath` and `rename` paths in hashline-edit
- Validation of `paths` parameter in ast-grep tools
- Tests covering traversal attempts (`../../etc/passwd`, symlinks, absolute paths outside workspace)

**Key considerations:**
- Use `realpath` to resolve symlinks before comparison
- Handle edge case: path equals workspace root (should be allowed for grep/glob, not for hashline-edit file operations)
- Return clear error messages so agents understand why the path was rejected
- The check must normalize both paths (trailing slashes, double slashes)

**Risks:**
- `realpath` fails on non-existent files (hashline-edit creates new files). For new files, validate the parent directory instead.
- Symlink resolution could be expensive for glob results — validate at the tool entry point, not per-result.

### WS2: Glob Fallback Fix
**Purpose:** Fix broken non-rg Unix fallback that executes grep binary with find-style arguments.

**What it must produce:**
- Correct `find` binary resolution when `rg` is unavailable
- Working `buildFindArgs` path that uses the actual `find` command
- Test for non-rg fallback behavior

**Key considerations:**
- `glob/constants.ts` re-exports from `grep/` which resolves to `rg` or system `grep`. Neither is `find`.
- The fix needs a separate path resolution for `find` binary in the glob module
- `buildFindArgs` logic at `glob/cli.ts:110-126` is already correct for `find` syntax — only the binary path is wrong

**Interfaces with WS1:** The workspace boundary check (WS1) should be applied after path resolution regardless of which backend is used.

### WS3: Config Loading Improvements
**Purpose:** Surface config errors visibly and use correct config dir resolution.

- `loadPluginConfig` passes `input.client` to `getOpenCodeConfigDir()` as the `binary` parameter. If `input.client` is not a recognized binary name, defaults to `"opencode"` (CLI behavior). This is a best-effort improvement — full desktop detection may require OpenCode API clarification.
- Invalid config produces a visible warning (not just silent log-to-file)
- Desktop/Tauri config dir is resolved when running under desktop runtime

**Key considerations:**
- The `input` parameter from OpenCode provides `{ client, directory, worktree }`. The `client` field likely indicates runtime type.
- Need to determine how to surface warnings — return a result object with warnings, or use the existing logger with a more visible output path.
- Must not break existing CLI behavior when adding desktop support.

**Risks:**
- The `input.client` shape may not clearly distinguish CLI from desktop. Need to verify the OpenCode plugin API.
- Surfacing warnings without a proper channel may require compromises (e.g., console.warn as fallback).

### WS4: Prompt Injection Fixes
**Purpose:** Make runtime context injection idempotent and hashline-edit prompt conditional.

**What it must produce:**
- `appendRuntimeContextToAgents` checks for existing `<available_resources>` before appending
- Hashline-edit workflow section in agent prompts is gated on `hashline_edit` being enabled
- Prompt section references (`SHARED_SECTIONS.hashlineEditWorkflow`) conditionally included based on config

**Key considerations:**
- Idempotency check: simple string `includes()` on the marker tag
- Hashline-edit conditionality: agent factories already receive config context — thread `hashline_edit` enabled state through
- Affects `bytes/default.ts`, `bytes/gpt.ts`, `bytes/gemini.ts` prompt templates
- The `general` agent prompt also references hashline-edit — check and gate similarly

**Interfaces with WS6:** Dead field removal may affect how config is threaded to agent factories.

### WS5: Dead Code Removal
**Purpose:** Remove schema fields and code that create a misleading API surface.

- Verify schema uses non-strict parsing (`.passthrough()` or default object behavior), then remove dead fields from `oc-blackbytes-config.ts` schema
- Remove `disabled_hooks` from schema (no consumers)
- Remove `mcp_env_alllowlist` from schema (typo, no consumers)
- Remove `auto_update` from schema (no consumers)
- Remove `_migrations` from schema (no consumers)
- Remove `migrateAgentConfig()` and `migrateToolsToPermission()` from `permission-compat.ts` (unused)
- Remove `createAgentToolAllowlist()` from `permission-compat.ts` (unused — denylist→allowlist migration is deferred)
- Clean up any imports/exports that reference removed code

**Key considerations:**
- Zod v4 with `.passthrough()` or `.strip()` behavior — verify that removing fields doesn't cause validation errors for users who have them in their config
- If Zod strict mode is used, users with these fields would get errors. Check the schema's parsing mode.
- Keep a clean git history: one commit for schema cleanup, one for code cleanup

**Risks:**
- Users who have `disabled_hooks` or `auto_update` in their config will see no effect (already true), but if schema uses strict parsing, removal could break validation. Must verify.

### WS6: Bug Fixes
**Purpose:** Fix specific correctness bugs identified in the review.

- Fix line count off-by-one in `tool-execute-after-handler.ts:163` — handle trailing newline
- Standardize SDK imports to `@opencode-ai/sdk/v2` across all files (this is the v2 subpath export; `@opencode-ai/sdk` is the root package)

**Key considerations:**
- Line count fix: `content.endsWith("\n") ? content.split("\n").length - 1 : content.split("\n").length`
- SDK imports: files using `@opencode-ai/sdk` should be updated to `@opencode-ai/sdk/v2` for type imports (Config, McpRemoteConfig, etc.). Verify by checking that `@opencode-ai/sdk/v2` resolves correctly before bulk migration.

### WS7: Test Coverage
**Purpose:** Add tests for critical paths that currently lack coverage.

**What it must produce:**
- Tests for `handleAgentConfig` — merge precedence, superseded agents, default agent, runtime context injection
- Tests for `handleMcpConfig` — disable semantics (user-disabled vs plugin-disabled)
- Tests for `handleChatParams` — model family detection, option stripping per provider
- Tests for `tool.execute.after` — read rewriting, write summary, line count accuracy
- Tests for workspace boundary utility (WS1)
- Tests for glob non-rg fallback (WS2)

**Key considerations:**
- Use `bun:test` framework (existing convention)
- Mock OpenCode types as needed
- Test files go in `test/` directory following existing naming convention
- Focus on behavior, not implementation details

**Interfaces:** Depends on all other workstreams being complete (tests verify the fixes).

## 5. Dependency and Sequencing Model

```
WS1 (Workspace Boundary) ──┐
                            ├──→ WS7 (Tests)
WS2 (Glob Fallback) ───────┤
                            │
WS3 (Config Loading) ───────┤
                            │
WS4 (Prompt Injection) ─────┤
                            │
WS5 (Dead Code Removal) ────┤
                            │
WS6 (Bug Fixes) ────────────┘
```

**Hard blockers:**
- WS7 depends on all other workstreams (tests verify the fixes)

**No dependencies between each other:**
- WS1, WS2, WS3, WS4, WS5, WS6 are all independent and can proceed in parallel

**Soft sequencing preferences:**
- WS1 before WS2 (workspace boundary utility can be reused in glob)
- WS5 before WS4 (dead code removal simplifies config threading for prompts)

**Recommended execution order for serial implementation:**
1. WS1 (Workspace Boundary) — highest security impact
2. WS2 (Glob Fallback) — reuses WS1 utility
3. WS6 (Bug Fixes) — small, self-contained
4. WS5 (Dead Code Removal) — cleanup
5. WS3 (Config Loading) — moderate complexity
6. WS4 (Prompt Injection) — touches prompts, benefits from clean config
7. WS7 (Tests) — validates everything

## 6. Key Design and Delivery Decisions

### D1: Workspace boundary check uses `realpath` with new-file fallback
**Rationale:** `realpath` catches symlink escapes. For files that don't exist yet (hashline-edit create), we validate the parent directory's realpath instead.
**Consequence:** Adds a filesystem call per tool invocation. Acceptable overhead for security.

### D2: Glob fallback resolves `find` binary independently
**Rationale:** The current approach of reusing grep CLI resolution for glob is fundamentally wrong for the non-rg path. Glob needs its own binary resolution for the `find` fallback.
**Consequence:** Small duplication of binary resolution logic, but correct behavior.

### D3: Dead schema fields are removed, not deprecated
**Rationale:** These fields never had consumers. Deprecation implies they once worked. Removal is cleaner.
**Consequence:** If users have these in their config, Zod behavior depends on parsing mode. We must ensure `.passthrough()` or equivalent is used so unknown fields don't cause errors.

### D4: Config warnings use logger + return value
**Rationale:** The buffered file logger alone is insufficient for user visibility. Returning a structured result with warnings allows the caller to decide how to surface them.
**Consequence:** Changes the `loadPluginConfig` return type. Callers must handle the new shape.

### D5: Runtime context idempotency via marker check
**Rationale:** Simple `includes("<available_resources>")` check before appending. No need for complex dedup logic since the content is deterministic per config state.
**Consequence:** If the marker string appears in user-authored prompt content, it could cause a false positive skip. Acceptable risk — the marker is XML-like and unlikely in user prompts.

### D6: Hashline-edit prompt conditionality via config parameter
**Rationale:** Agent factories already receive config-derived parameters. Adding a `hashlineEditEnabled` boolean is the simplest threading mechanism.
**Consequence:** All three bytes prompt variants (default, gpt, gemini) plus general agent prompt need conditional sections.

## 7. Risks, Ambiguities, and Assumptions

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `realpath` on non-existent parent dir | Medium | Blocks hashline-edit file creation | Fall back to `resolve` + `normalize` and check prefix |
| Removing schema fields breaks strict Zod parsing | Low | Config validation fails for existing users | Verify Zod parsing mode; use `.passthrough()` if needed |
| `input.client` doesn't clearly indicate runtime type | Medium | Desktop config dir still not resolved | Inspect OpenCode plugin types; add heuristic fallback |
| Glob `find` fallback untestable in CI (rg always present) | Medium | Regression goes undetected | Mock CLI resolution in tests |

### Ambiguities
- **How does OpenCode surface plugin warnings?** The plugin API may not have a warning channel. May need to fall back to stderr or a visible log path.
- ~~**Which SDK import is canonical?** `@opencode-ai/sdk` vs `@opencode-ai/sdk/v2` — need to check package exports.~~ → **Decided:** `@opencode-ai/sdk/v2` is canonical for type imports (v2 subpath export).
- **Does OpenCode sandbox tool paths at runtime?** If yes, our checks are defense-in-depth. If no, they are the only protection.

### Assumptions
- The workspace `directory` parameter is always an absolute, canonical path
- Zod schema uses non-strict parsing (unknown fields are ignored, not rejected)
- `bun:test` supports the mocking patterns needed for CLI resolution and config loading
- The OpenCode plugin API's `input` parameter shape is stable

## 8. Execution Slices / Phases

### Phase 1: Security & Correctness (WS1 + WS2 + WS6)
**Objective:** Fix all P0 security and correctness issues.

**Included:**
- WS1: Shared workspace boundary utility + integration into all bundled tools
- WS2: Glob fallback binary resolution fix
- WS6: Line count off-by-one fix, SDK import audit

**Validation:** Unit tests for boundary check, manual test of glob without rg, line count accuracy test.

**After this lands:** All tools are workspace-safe, glob works on all platforms, line counts are accurate.

### Phase 2: Config & Prompt Quality (WS3 + WS4 + WS5)
**Objective:** Fix config handling, clean dead code, make prompts accurate.

**Included:**
- WS3: Config loader improvements (error surfacing, desktop support)
- WS4: Idempotent runtime context, conditional hashline-edit prompts
- WS5: Dead schema fields and unused code removal

**Dependencies:** None on Phase 1 (can run in parallel if desired).

**Validation:** Config loading tests with invalid/missing configs, idempotency tests for prompt injection, schema validation tests.

**After this lands:** Config errors are visible, prompts match actual tool availability, no misleading API surface.

### Phase 3: Test Coverage (WS7)
**Objective:** Add regression tests for all changes and critical untested paths.

**Included:**
- WS7: Full test suite for handlers, config merging, tool execution

**Dependencies:** Phases 1 and 2 must be complete.

**Validation:** `bun test` passes, coverage of critical paths verified.

**After this lands:** Confidence in future changes, regression safety net.

## 9. Validation and Acceptance Framing

### Functional validation
- Workspace boundary: paths outside workspace are rejected with clear error messages
- Glob fallback: `find`-based globbing works when `rg` is not available
- Config loading: invalid JSONC produces visible warning, desktop config dir is discovered
- Runtime context: multiple config hook invocations don't duplicate `<available_resources>`
- Hashline-edit prompt: disabled hashline_edit → no hashline workflow in agent prompts
- Line count: files with trailing newlines report correct line count
- Dead code: removed fields don't appear in schema, removed functions don't appear in exports

### Integration validation
- `bun run build` succeeds
- `bun run check` passes (Biome lint + format)
- `bun test` passes with all new and existing tests
- Plugin loads correctly in OpenCode (manual smoke test)

### Security validation
- Path traversal attempts (`../`, absolute paths, symlinks) are all rejected
- Hashline-edit `rename` path is also boundary-checked
- No tool can read/write/delete files outside the workspace

### Failure mode validation
- Missing `rg` binary → glob gracefully falls back to `find`
- Missing config file → plugin loads with defaults (existing behavior preserved)
- Invalid config → warning surfaced, defaults used
- Non-existent parent dir for hashline-edit → clear error (not a boundary violation false positive)

### Regression expectations
- All existing tests continue to pass
- No behavioral changes for valid configs and in-workspace paths
- Agent prompt content unchanged when hashline_edit is enabled (default)

## 10. Task Graph Mapping

### Top-level tasks (from workstreams)
- **WS1 → `security/workspace-boundary`**: Shared utility + integration into 4 tool modules (grep, glob, hashline-edit, ast-grep)
- **WS2 → `fix/glob-fallback`**: Binary resolution fix in glob module
- **WS3 → `fix/config-loading`**: Loader improvements
- **WS4 → `fix/prompt-injection`**: Idempotency + conditional sections
- **WS5 → `cleanup/dead-code`**: Schema + permission-compat cleanup
- **WS6 → `fix/misc-bugs`**: Line count + SDK imports
- **WS7 → `test/coverage`**: New test files for handlers and tools

### Child task breakdown

**WS1 — 4 child tasks:**
1. Create `src/shared/utils/workspace-boundary.ts` utility
2. Integrate into `grep/tools.ts` and `glob/tools.ts`
3. Integrate into `hashline-edit/hashline-edit-executor.ts` (filePath + rename)
4. Integrate into `ast-grep/search.ts` and `ast-grep/replace.ts` (paths parameter)

**WS2 — 2 child tasks:**
1. Create `glob/find-cli.ts` for `find` binary resolution (separate from grep CLI)
2. Update `glob/cli.ts` to use find-specific resolution in non-rg path

**WS3 — 2 child tasks:**
1. Fix `loadPluginConfig` to pass `input.client` to `getOpenCodeConfigDir()` as the `binary` parameter. If `input.client` is not a recognized binary name, default to `"opencode"` (CLI behavior). This is a best-effort improvement — full desktop detection may require OpenCode API clarification.
2. Add structured warning return for invalid/unparseable config

**WS4 — 2 child tasks:**
1. Add idempotency check to `appendRuntimeContextToAgents`
2. Gate hashline-edit prompt sections on config in all agent prompt variants

**WS5 — 2 child tasks:**
1. Verify schema uses non-strict parsing (`.passthrough()` or default object behavior), then remove dead fields from `oc-blackbytes-config.ts` schema
2. Remove unused functions from `permission-compat.ts`

**WS6 — 2 child tasks:**
1. Fix line count off-by-one in `tool-execute-after-handler.ts`
2. Standardize SDK imports to `@opencode-ai/sdk/v2` across all files

**WS7 — 4 child tasks:**
1. Tests for workspace boundary utility
2. Tests for agent config merging and runtime context injection
3. Tests for MCP config merging
4. Tests for chat params handler and tool.execute.after handler

### Dependency encoding
- WS1.1 → WS1.2, WS1.3 (utility must exist before integration)
- WS2.1 → WS2.2 (find resolution must exist before cli.ts update)
- All WS1-6 → WS7 (tests verify completed work)

### Context each child task must carry
- **WS1 tasks:** Workspace root is `directory` from tool context. Use `realpath` with new-file fallback. Reject with clear error message. Normalize paths before comparison. Applies to grep, glob, hashline-edit, and ast-grep tools.
- **WS2 tasks:** Bug is at `glob/cli.ts:122-126` — `cli.path` is grep binary, not `find`. `buildFindArgs` syntax is correct, only binary path needs fixing.
- **WS3 tasks:** Current code at `config/loader.ts:28-30` ignores `input`. Desktop resolution exists at `opencode-config-dir.ts:79-106`. Pass `input.client` as `binary` param, default to `"opencode"` if unrecognized.
- **WS4 tasks:** Marker tag is `<available_resources>`. Check with `includes()`. Hashline config available via plugin config `hashline_edit` field.
- **WS5 tasks:** Dead fields: `disabled_hooks`, `mcp_env_alllowlist`, `auto_update`, `_migrations`. Unused functions: `migrateAgentConfig`, `migrateToolsToPermission`, `createAgentToolAllowlist`. Verify non-strict Zod parsing before removal.
- **WS6 tasks:** Line count fix: handle trailing newline in `content.split("\n")`. SDK imports: standardize to `@opencode-ai/sdk/v2` for type imports.
- **WS7 tasks:** Use `bun:test`. Follow existing test patterns in `test/config.test.ts`. Mock as needed.
