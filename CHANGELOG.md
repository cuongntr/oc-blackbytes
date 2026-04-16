# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
