# Debugging the Plugin

Debugging centers on four things:

1. local verification
2. OpenCode config inspection
3. plugin log inspection
4. runtime behavior of hooks, agents, MCPs, and bundled tools

## Verification commands

Run these first:

```bash
bun run build
bun run check
bun test
```

## Logging

### OpenCode-integrated logs

Use `client.app.log()` for logs that should flow through OpenCode:

```ts
await client.app.log({
  body: {
    service: "oc-blackbytes",
    level: "info",
    message: "Something happened",
    extra: { key: "value" },
  },
})
```

### Plugin file logger

The plugin also writes buffered logs to:

```text
/tmp/oc-blackbytes.log
```

Inspect it with:

```bash
cat /tmp/oc-blackbytes.log
tail -f /tmp/oc-blackbytes.log
```

This log is the fastest way to inspect:

- config discovery and validation
- MCP registration and omission
- agent creation and merge behavior
- command registration
- tool registration
- model fallback resolution
- binary resolution and download behavior
- runtime `chat.params` family detection

### OpenCode logs

OpenCode stores separate runtime logs. Stream them while reproducing an issue:

```bash
opencode --print-logs
opencode --log-level DEBUG --print-logs
```

## Local plugin loading

### Load from a local package path

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/oc-blackbytes"]
}
```

Build first, then inspect the resolved config:

```bash
bun run build
opencode debug config
```

### Load from `.opencode/plugins/`

```bash
cp dist/index.js .opencode/plugins/blackbytes.js
```

Plugins in `.opencode/plugins/` load automatically at startup.

## Config debugging

The plugin loads `oc-blackbytes.jsonc` or `oc-blackbytes.json` from the resolved OpenCode config directory.

Resolution rules:

- CLI uses the OpenCode config directory by default
- `OPENCODE_CONFIG_DIR` overrides the CLI location
- desktop builds use Tauri config directories
- desktop resolution can fall back to the CLI config location when an existing CLI OpenCode config is present

Useful check:

```bash
opencode debug config
```

Confirm that the final resolved config contains:

- the plugin entry
- merged MCP entries
- merged agent entries
- merged command entries
- expected behavior from `disabled_mcps`, `disabled_agents`, `disabled_tools`, `hashline_edit`, `model_fallback`, and `websearch.provider`

## MCP debugging

Built-in MCPs:

- `websearch`
- `context7`
- `grep_app`

Check for these cases:

1. `disabled_mcps` removed an MCP after merge
2. a user-defined MCP with the same name overrode the built-in entry
3. `websearch.provider` is set to `tavily` but `TAVILY_API_KEY` is missing, so the built-in `websearch` MCP is omitted
4. a user MCP is present with `enabled: false`

## Agent debugging

Built-in agents:

- `bytes`
- `explore`
- `oracle`
- `librarian`
- `general`

When debugging agent config, verify:

1. `default_agent` resolves to `bytes` when the user did not set one
2. user-defined agents override built-in agents with the same key
3. user agents with `disable: true` stay present but disabled
4. names in `disabled_agents` are removed after merge
5. built-in `build` and `plan` are disabled unless the user configured them explicitly
6. per-agent overrides from `agents` are applied correctly
7. runtime context injection appends `<available_resources>` with enabled tools, MCPs, and peer agents

Useful log patterns:

```text
[agents] Factory 'oracle': modelHint=openai/gpt-5.4
[agents] Model resolution: used fallback chains (2 provider(s) available)
Runtime context injected: 5 tools, 3 MCPs
```

## Command debugging

Built-in commands are registered through the `config` hook.

Current built-in command:

- `/setup-models`

Useful log pattern:

```text
[commands] Registered 1 built-in command(s)
```

If a built-in command is missing:

1. check whether a user-defined command with the same name exists
2. inspect `/tmp/oc-blackbytes.log` for a skip message
3. run `opencode debug config` and inspect the final `command` section

## Tool debugging

Bundled tools:

- `hashline_edit`
- `ast_grep_search`
- `ast_grep_replace`
- `grep`
- `glob`

Check three things first:

1. whether the tool name is listed in `disabled_tools`
2. whether `hashline_edit` is set to `false`
3. whether the required CLI binary was found or downloaded successfully

### Binary cache locations

Bundled binaries are cached under the platform cache directory for `oc-blackbytes`:

- macOS: `~/Library/Caches/oc-blackbytes`
- Linux: `${XDG_CACHE_HOME:-~/.cache}/oc-blackbytes`
- Windows: `%LOCALAPPDATA%\oc-blackbytes`

### `grep` and `glob`

These tools resolve `rg` automatically and use a cached binary when necessary. If results are missing or unexpectedly slow, inspect the log to confirm which backend was selected.

### `ast_grep_search` and `ast_grep_replace`

These tools resolve `sg` automatically. Common failure modes:

- unsupported platform
- download failure
- invalid structural pattern
- path outside the workspace

Pattern reminder: `ast-grep` expects complete AST nodes, not partial syntax fragments.

### `hashline_edit`

When enabled:

- `read` output is rewritten into `LINE#ID|content`
- successful `write` output is rewritten to `File written successfully. N lines written.`

If those transformations are missing, verify that `hashline_edit` is not disabled in plugin config.

For edit failures, check:

1. whether anchors were copied exactly from the latest `read` output
2. whether multiple edits were issued against a stale snapshot
3. whether replacement lines accidentally included surrounding unchanged lines

## Chat header debugging

The `chat.headers` hook injects `x-initiator: agent` for:

- `github-copilot`
- `github-copilot-enterprise`

If the header is missing, verify:

1. the provider ID is one of those values
2. the runtime is not using the `@ai-sdk/github-copilot` API path, which skips injection

## Chat params debugging

The `chat.params` hook uses the actual runtime model to detect the family and adjust provider-specific options.

Detection order:

1. provider ID
2. model-name heuristics for proxy providers and GitHub Copilot model IDs

Runtime behavior:

- Claude: applies `thinking` defaults for `bytes`, `oracle`, and `general` when reasoning is supported; strips OpenAI-only options
- OpenAI: applies `reasoningEffort` defaults for `bytes`, `oracle`, and `general` when reasoning is supported; strips Claude-only options
- Gemini and other providers: strips provider-specific options
- `explore` and `librarian`: no default thinking/reasoning config

Useful log pattern:

```text
[chat.params] agent=oracle model=openai/gpt-5.4 family=openai reasoning=true
```

If parameter adaptation looks wrong, confirm:

1. the runtime model family is being detected correctly
2. the model actually reports `capabilities.reasoning`
3. the agent has a user override for `reasoningEffort` or `temperature`

## Model fallback debugging

Fallback resolution only runs when `model_fallback: true`.

When enabled, the plugin calls `client.provider.list()` during startup and attempts to resolve configured models through:

1. the primary model
2. the agent’s `fallback_models`
3. the global `fallback_models`

Useful log patterns:

```text
[model-resolver] Connected providers: anthropic, google
[model-resolver] Resolving agent models with fallback chains...
  [model-resolver] oracle: primary model openai/gpt-5.4 not available, trying fallbacks...
  [model-resolver] oracle: resolved → anthropic/claude-opus-4-6 (agent fallback)
```

Common issues:

1. `model_fallback` is not enabled
2. provider discovery failed or timed out
3. no entry in the per-agent or global fallback chain matches an available provider/model
4. a fallback entry applied different `reasoningEffort` or `temperature` than expected because that entry included its own overrides

## Unit tests

Run tests with:

```bash
bun test
```

`test/config.test.ts` is the reference pattern for isolated config-loader and merge behavior tests.

## Isolating plugin issues

Disable plugins entirely to confirm the issue belongs to `oc-blackbytes`:

```jsonc
{ "plugin": [] }
```

You can also temporarily remove local plugin copies:

- global: `~/.config/opencode/plugins/`
- project: `<project>/.opencode/plugins/`

Then re-enable plugins one at a time.

## Clearing stale state

If a local build or cached binary looks stale, clear the relevant cache and rebuild.

Common cleanup targets:

```bash
rm -rf ~/.cache/opencode
rm -rf ~/Library/Caches/oc-blackbytes
```

On Linux, replace the second path with `${XDG_CACHE_HOME:-~/.cache}/oc-blackbytes`.

## Iteration workflow

1. edit files in `src/`
2. run `bun run build`
3. run `bun run check`
4. run `bun test`
5. load through a `file://` plugin entry or `.opencode/plugins/`
6. reproduce with `opencode --print-logs --log-level DEBUG`
7. inspect `/tmp/oc-blackbytes.log`
