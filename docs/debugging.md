# Debugging the Plugin

OpenCode plugins have no dedicated debugger. Debugging relies on structured logging, log inspection, and unit tests.

## Structured Logging

Use `client.app.log()` instead of `console.log`. Logs are written to OpenCode's internal logging system.

```ts
await client.app.log({
  body: {
    service: "oc-blackbytes",
    level: "info",  // debug | info | warn | error
    message: "Something happened",
    extra: { key: "value" },
  },
})
```

### Plugin File Logger

The plugin also has a built-in buffered file logger that writes to `/tmp/oc-blackbytes.log`:

```ts
import { log } from "./shared"

log("Something happened", { key: "value" })
```

View plugin logs:

```bash
cat /tmp/oc-blackbytes.log
tail -f /tmp/oc-blackbytes.log  # stream in real time
```

## Viewing Logs

Log files are written to:

- **macOS/Linux**: `~/.local/share/opencode/log/`
- **Windows**: `%USERPROFILE%\.local\share\opencode\log\`

Files are timestamped (e.g., `2025-01-09T123456.log`). Only the 10 most recent are kept.

## Real-Time Log Streaming

Run OpenCode with `--print-logs` to stream output to your terminal:

```bash
opencode --print-logs
```

For maximum detail:

```bash
opencode --log-level DEBUG --print-logs
```

## Local Plugin Loading

### Via `opencode.json`

Point the config at your local package path:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///Users/cuongnt/Work/personal/oc-blackbytes"]
}
```

Verify it loads:

```bash
opencode debug config
```

### Via plugin directory

Copy the built file directly into the project plugin directory for instant loading:

```bash
cp dist/index.js .opencode/plugins/blackbytes.js
```

Local plugins in `.opencode/plugins/` are auto-loaded at startup.

## Unit Tests

Test hook logic in isolation with `bun:test`:

```bash
bun test
```

Mock `client.app.log` to verify calls without a running OpenCode instance. See `test/config.test.ts` for the pattern.

## Isolate Plugin Issues

If OpenCode crashes or misbehaves, disable all plugins:

```jsonc
// ~/.config/opencode/opencode.jsonc
{ "plugin": [] }
```

Or clear plugin directories:

- **Global**: `~/.config/opencode/plugins/`
- **Project**: `<project>/.opencode/plugins/`

Re-enable one at a time to identify the culprit.

## Clear Cache

If a plugin install is stuck or behavior is stale:

```bash
rm -rf ~/.cache/opencode
```

## Iteration Workflow

1. Edit source files in `src/`
2. `bun run build`
3. Load via `file://` path in `opencode.json` or copy to `.opencode/plugins/`
4. Run `opencode --print-logs --log-level DEBUG` in a test project
5. Watch for plugin initialization and hook execution in logs
6. Iterate
