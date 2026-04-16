# Debugging the Plugin

Debugging relies on structured logs, deterministic local verification, and inspecting the behavior of the plugin's hooks, agents, and bundled tools.

## Verification commands

Run these checks before assuming a runtime issue:

```bash
bun run build
bun run check
bun test
```

## Structured logging

Use `client.app.log()` for OpenCode-integrated logs instead of `console.log`.

```ts
await client.app.log({
  body: {
    service: "oc-blackbytes",
    level: "info", // debug | info | warn | error
    message: "Something happened",
    extra: { key: "value" },
  },
})
```

## Plugin file logger

The plugin also writes buffered logs to `/tmp/oc-blackbytes.log`.

```ts
import { log } from "./shared"

log("Something happened", { key: "value" })
```

View the file log with:

```bash
cat /tmp/oc-blackbytes.log
tail -f /tmp/oc-blackbytes.log
```

This log is the fastest way to inspect:

- config file detection and validation failures
- MCP registration and omission decisions
- agent and tool registration
- bundled binary download or fallback behavior

## OpenCode log output

OpenCode stores its own logs separately:

- **macOS/Linux**: `~/.local/share/opencode/log/`
- **Windows**: `%USERPROFILE%\.local\share\opencode\log\`

Stream logs directly in the terminal while reproducing an issue:

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

Build first, then verify the resolved config:

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

- CLI uses `${XDG_CONFIG_HOME:-~/.config}/opencode` by default
- `OPENCODE_CONFIG_DIR` overrides the CLI config directory
- Desktop builds use the Tauri config directories for `ai.opencode.desktop` and `ai.opencode.desktop.dev`
- Desktop resolution falls back to the CLI config directory when an existing CLI `opencode.json` or `opencode.jsonc` is present

Useful checks:

```bash
opencode debug config
```

- Confirm the plugin appears in the final OpenCode config.
- Confirm merged `mcp` and `agent` sections include the expected built-in entries.
- Confirm `disabled_mcps`, `disabled_agents`, `disabled_hooks`, `disabled_tools`, `hashline_edit`, and `websearch.provider` produce the expected final shape.

`OPENCODE_CONFIG_DIR` is the fastest way to point the plugin at an isolated test config directory.

### Agent merge behavior

The plugin installs these built-in agents:

- `bytes`
- `explore`
- `oracle`
- `librarian`
- `general`

When debugging agent config:

1. Confirm `default_agent` resolves to `bytes` when the user did not set one explicitly.
2. Confirm user-supplied agents still override built-in entries with the same key.
3. Confirm user agents with `disable: true` remain present but disabled.
4. Confirm names listed in `disabled_agents` are removed after merge.
5. Confirm OpenCode's `build` and `plan` agents are disabled unless they were configured explicitly.
6. Confirm per-agent model overrides from `agents` config are applied (model, reasoningEffort, temperature).

## Tool debugging

The plugin registers these local tools:

- `hashline_edit`
- `ast_grep_search`
- `ast_grep_replace`
- `grep`
- `glob`

When diagnosing tool issues, check three things first:

1. Whether the tool was disabled through `disabled_tools`
2. Whether `hashline_edit` was turned off explicitly
3. Whether the required CLI binary was found or downloaded successfully

### Binary cache locations

Bundled tool binaries are cached under the platform cache directory for `oc-blackbytes`:

- **macOS**: `~/Library/Caches/oc-blackbytes`
- **Linux**: `${XDG_CACHE_HOME:-~/.cache}/oc-blackbytes`
- **Windows**: `%LOCALAPPDATA%\oc-blackbytes`

This cache is used for downloaded `rg` and `sg` binaries.

### `grep` / `glob`

`grep` and `glob` prefer ripgrep, then cached ripgrep, then system `grep` as a fallback. If results look incomplete or slow, inspect the log file to confirm which backend was selected.

### `ast_grep_search` / `ast_grep_replace`

`ast-grep` downloads the `sg` binary when needed. Failures usually come from unsupported platforms, download problems, or malformed structural patterns.

### `hashline_edit`

When `hashline_edit` is enabled:

- `read` output is rewritten into `LINE#ID|content` format
- `write` success output is rewritten into `File written successfully. N lines written.`

The tool itself supports `replace`, `append`, and `prepend` edits, optional `rename`, optional `delete`, and batched anchored edits against a single read snapshot.

If those transformations are missing, verify that `hashline_edit` is not set to `false` in plugin config.

## Chat header debugging

The `chat.headers` hook injects `x-initiator: agent` for:

- `github-copilot`
- `github-copilot-enterprise`

If the header is missing, confirm the provider ID and whether the model is using the `@ai-sdk/github-copilot` API path, which bypasses this injection.

## Chat params debugging

The `chat.params` hook adapts model parameters at runtime based on the actual model family and agent role.

The hook detects the model family using:

1. Provider ID (most reliable): `anthropic` → Claude, `openai` → OpenAI, `google`/`google-vertex` → Gemini
2. Model name heuristics (for `github-copilot` and proxy providers): checks for `claude-*`, `gpt-*`, `gemini-*` in the model ID

Parameter application:

- **Claude**: Applies `thinking` config with per-agent budget tokens (bytes: 32K, oracle: 32K, general: 16K) when the model supports reasoning. Strips `reasoningEffort` and `textVerbosity`.
- **OpenAI**: Applies `reasoningEffort` per agent (oracle: `"high"`, bytes/general: `"medium"`) when the model supports reasoning. Strips `thinking`.
- **Gemini / Other**: Strips all provider-specific options.
- **explore / librarian**: No thinking or reasoning defaults applied (speed priority).

If parameter adaptation looks wrong, inspect the log file for `[chat.params]` entries which show the detected agent, model, family, and reasoning capability.

## Unit tests

Run tests with:

```bash
bun test
```

The existing test suite uses temp directories and `OPENCODE_CONFIG_DIR` overrides to isolate config behavior. `test/config.test.ts` is the reference pattern for config loader tests.

## Isolating plugin issues

Disable plugins entirely to confirm the problem belongs to `oc-blackbytes`:

```jsonc
{ "plugin": [] }
```

You can also remove local plugin copies temporarily:

- **Global**: `~/.config/opencode/plugins/`
- **Project**: `<project>/.opencode/plugins/`

Then re-enable one plugin at a time.

## Clearing stale state

If OpenCode or a locally installed plugin looks stale, clear the relevant cache or plugin copy and rebuild.

Common cleanup targets:

```bash
rm -rf ~/.cache/opencode
rm -rf ~/Library/Caches/oc-blackbytes
```

On Linux, replace the second path with `${XDG_CACHE_HOME:-~/.cache}/oc-blackbytes`.

## Iteration workflow

1. Edit files in `src/`
2. Run `bun run build`
3. Run `bun run check`
4. Run `bun test`
5. Load through a `file://` plugin entry or `.opencode/plugins/`
6. Reproduce with `opencode --print-logs --log-level DEBUG`
7. Inspect `/tmp/oc-blackbytes.log` and iterate
