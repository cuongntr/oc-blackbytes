# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.3] - 2026-04-17

### Fixed

- `librarian` agent no longer prompts for permission on every `/tmp` read or shell command. The agent now has `bash: "allow"` and `external_directory: "allow"` permissions so it can clone repos to the system temp directory and run `gh`/`git` without interactive approval. Write-side tools (`write`, `edit`, `hashline_edit`, `ast_grep_replace`, `apply_patch`, `task`) remain denied, preserving the read-only guarantee.

## [0.7.1] - 2026-04-17

### Added

- Workspace boundary enforcement for all bundled tools — tools operate within the project worktree and reject paths outside it
- `find` binary resolution fallback for glob tool when `fd` is unavailable
- Test coverage for agent config merging, MCP config merging, handler registration, and workspace boundary validation

### Changed

- Config loader accepts the OpenCode `client` object for more reliable config directory resolution
- Removed deprecated `permission-compat.ts` compatibility layer
- Removed unused schema fields (`disabled_hooks`, `mcp_env_allowlist`, `auto_update`, `_migrations`)
- Debugging guide consolidated into README (previously a separate `docs/debugging.md` file)

## [0.7.0] - 2026-04-16

### Added

- Language matching in all agent prompts — agents detect the user's language and respond in the same language while keeping code, technical terms, file paths, tool names, and git messages in English
- `question: "allow"` permission on the `bytes` agent, enabling it to ask users clarifying questions via OpenCode's built-in question tool when a task is ambiguous
- Runtime context injection — after config merging, each enabled agent's prompt is appended with an `<available_resources>` section listing the currently enabled bundled tools, active MCP servers (with descriptions for built-in MCPs), and peer agents (excluding itself)
- `runtime-context.ts` utility module (`src/extensions/agents/utils/`) with `computeRuntimeContext`, `buildRuntimeContextSection`, and `appendRuntimeContextToAgents` functions

### Changed

- Documentation updated across README, AGENTS.md, configuration guide, and debugging guide to reflect language matching, question permission, and runtime context injection

## [0.6.0] - 2026-04-16

### Added

- Built-in `/setup-models` command — interactive wizard that discovers available models, recommends optimal assignments per agent role, and writes configuration to `oc-blackbytes.jsonc`
- Command config handler pipeline for registering built-in commands alongside MCPs and agents
- Command definitions in `src/extensions/commands/` following the extensions/handlers separation pattern

### Changed

- `model_fallback` reverted to `false` by default — provider discovery and fallback resolution require explicit opt-in via `model_fallback: true`
- Provider discovery now has a 20-second timeout to prevent hanging when the OpenCode server is slow to respond
- Enhanced debug logging throughout agent resolution, model resolver, and config handler for easier troubleshooting
- Documentation updated across README, configuration guide, debugging guide, and AGENTS.md

## [0.5.0] - 2026-04-16

### Changed

- `model_fallback` now defaults to `true` — provider discovery and fallback resolution are active out of the box without explicit opt-in. Set `model_fallback: false` to disable.
- Documentation updated to reflect `model_fallback` default change across README, configuration guide, and debugging guide

## [0.4.0] - 2026-04-16

### Added

- Model fallback resolution system — discovers connected providers at plugin init and resolves agent models through multi-level fallback chains (primary → per-agent fallback → builtin chain → global fallback → OpenCode default)
- Builtin fallback chains for `oracle`, `explore`, `librarian`, and `general` agents with provider-aware model preferences
- Prefix matching for model IDs to handle date-suffixed variants (e.g., `claude-sonnet-4` matches `claude-sonnet-4-20250514`)
- Parameter overrides (reasoningEffort, temperature) from fallback chain entries applied when a fallback model is selected
- `model_fallback` config flag to enable provider discovery and fallback resolution
- Configuration guide (`docs/configuration.md`) with full reference for all plugin settings

### Changed

- Documentation updated with model fallback resolution details, debugging guidance, and configuration examples

## [0.3.0] - 2026-04-16

### Added

- Per-agent model configuration via `agents` config field with `model`, `reasoningEffort`, `temperature`, and `fallback_models` per agent
- `chat.params` hook for runtime model parameter adaptation — detects the actual model family at inference time and applies provider-correct thinking/reasoning config per agent
- Model detection utilities for Claude, Kimi, and DeepSeek model families
- `FallbackModelsSchema` and `AgentModelConfigSchema` for flexible fallback chain configuration (reserved for future resolution)

### Changed

- Agent factory functions receive the configured model hint, enabling correct prompt variant selection based on the actual model family
- Documentation describes per-agent model configuration, runtime parameter adaptation, and `chat.params` hook behavior

## [0.2.0] - 2025-04-16

### Added

- Built-in agent provisioning for `bytes`, `explore`, `oracle`, `librarian`, and `general`
- Tool hook registration for `hashline_edit`, `ast_grep_search`, `ast_grep_replace`, `grep`, and `glob`
- `tool.execute.after` post-processing for hashline-aware `read` and `write` flows
- Automatic ripgrep and ast-grep binary download and cache management for bundled tools
- Agent prompt variants tuned for Claude, GPT, and Gemini model families
- `chat.headers` hook injecting `x-initiator: agent` for GitHub Copilot providers
- Skills awareness and proactive delegation in agent prompts

### Changed

- README and debugging documentation now describe the full current plugin surface, including agents, tools, hook behavior, configuration flags, and runtime requirements
- Refactored to handler-based architecture with bootstrap hook assembly

## [0.1.0] - 2025-04-15

### Added

- Initial release of oc-blackbytes OpenCode plugin
- Config hook with built-in MCP server provisioning (websearch, Context7, grep.app)
- JSONC config support (`oc-blackbytes.json` / `oc-blackbytes.jsonc`)
- Buffered file logger (`/tmp/oc-blackbytes.log`)
- Zod v4 schema validation for plugin config
- GitHub Actions CI and publish workflows
