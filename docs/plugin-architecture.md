# OpenCode Plugin Architecture

## Overview

OpenCode plugins are async factory functions that receive runtime context and return a set of hook implementations. They allow deep customization of OpenCode's behavior — from injecting environment variables to modifying LLM parameters, registering custom tools, and intercepting events.

## Core Types

### `PluginInput`

The context OpenCode provides to your plugin when it loads:

```ts
type PluginInput = {
    client: ReturnType<typeof createOpencodeClient>;  // SDK client for communicating back to OpenCode
    project: Project;                                 // Current project metadata
    directory: string;                                // Root directory of the project
    worktree: string;                                 // Git worktree path
    serverUrl: URL;                                   // OpenCode server URL
    $: BunShell;                                      // Pre-configured Bun shell for running commands
}
```

| Field | Purpose |
|---|---|
| `client` | SDK client to call OpenCode APIs (logging, fetching sessions, etc.) |
| `project` | Metadata about the current project |
| `directory` | Absolute path to the project root |
| `worktree` | Path to the active git worktree |
| `serverUrl` | URL of the running OpenCode server |
| `$` | Bun shell instance for executing shell commands |

### `PluginOptions`

```ts
type PluginOptions = Record<string, unknown>
```

Arbitrary configuration passed from `opencode.json`. A plugin can be registered as either:

```jsonc
{
  "plugin": [
    "oc-blackbytes",                                    // no options
    ["oc-blackbytes", { someSetting: true }]            // with options
  ]
}
```

### `Plugin` — Factory Function

```ts
type Plugin = (input: PluginInput, options?: PluginOptions) => Promise<Hooks>
```

Your plugin is an async function. It receives context + options, performs any setup, and returns a `Hooks` object.

## Hooks

Hooks are the extension points. Each is optional — implement only what you need.

### Lifecycle & Events

| Hook | Purpose |
|---|---|
| `event` | Listen to any OpenCode event (session lifecycle, tool calls, etc.) |
| `config` | React to configuration changes |

### Chat & LLM

| Hook | Purpose |
|---|---|
| `chat.message` | Modify incoming user messages before processing |
| `chat.params` | Override LLM parameters (temperature, topP, topK, max tokens) |
| `chat.headers` | Inject custom HTTP headers sent to the LLM provider |
| `experimental.chat.messages.transform` | Transform the full message history |
| `experimental.chat.system.transform` | Modify the system prompt sent to the LLM |
| `experimental.text.complete` | Modify generated text before display |

### Tools

| Hook | Purpose |
|---|---|
| `tool` | Register custom tools the LLM can call |
| `tool.execute.before` | Modify tool arguments before execution |
| `tool.execute.after` | Modify tool output (title, output text, metadata) after execution |
| `tool.definition` | Alter tool descriptions/parameters sent to the LLM |

### Shell & Permissions

| Hook | Purpose |
|---|---|
| `shell.env` | Inject environment variables into shell commands |
| `permission.ask` | Override file/command permission prompts (auto-allow/deny) |

### Commands

| Hook | Purpose |
|---|---|
| `command.execute.before` | Intercept custom command execution |

### Auth & Providers

| Hook | Purpose |
|---|---|
| `auth` | Add custom auth providers (OAuth/API key flows with prompts) |
| `provider` | Extend model provider behavior (dynamic model listing) |

### Experimental

| Hook | Purpose |
|---|---|
| `experimental.session.compacting` | Customize session compaction prompts (context strings or full prompt override) |

## Hook Pattern: Input/Output

Most hooks follow an **input/output** pattern:

```ts
"hook.name"?: (input: InputType, output: OutputType) => Promise<void>
```

- **`input`** — Read-only context about what's happening
- **`output`** — Mutable object you modify to influence behavior

Example — overriding LLM temperature:

```ts
"chat.params": async (input, output) => {
  output.temperature = 0.3  // override default
  output.topP = 0.9
}
```

Example — injecting shell env:

```ts
"shell.env": async (_input, output) => {
  output.env.MY_VAR = "value"
}
```

## How It All Fits Together

```
opencode.json ──plugin config──▶ PluginOptions
                                       │
OpenCode runtime ──environment──▶ PluginInput
                                       │
                               Plugin(input, options)
                                       │
                               returns Hooks ◀── your customizations
                                       │
                    OpenCode calls hooks at lifecycle points
```

1. **User** registers plugin in `opencode.json` (optionally with options)
2. **OpenCode** loads the plugin, constructs `PluginInput` from the running context
3. **Your plugin** factory runs, sets up any state, returns a `Hooks` object
4. **OpenCode** invokes your hooks at the appropriate lifecycle points

## Example: Minimal Plugin

```ts
import type { Hooks, Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ client, directory, worktree }) => {
  // Setup: log initialization
  await client.app.log({
    body: {
      service: "my-plugin",
      level: "info",
      message: "Plugin initialized",
      extra: { directory, worktree },
    },
  })

  // Return hooks
  return {
    "shell.env": async (_input, output) => {
      output.env.MY_PLUGIN_ENABLED = "1"
    },
    event: async ({ event }) => {
      await client.app.log({
        body: {
          service: "my-plugin",
          level: "info",
          message: `Event: ${event.type}`,
        },
      })
    },
  } satisfies Hooks
}

export default MyPlugin
```

## Project Structure

```
oc-blackbytes/
├── src/
│   └── index.ts          # Plugin source (single entry point)
├── test/
│   └── index.test.ts     # Tests with bun:test
├── dist/
│   └── index.js          # Build output (bun build)
├── docs/
│   └── plugin-architecture.md
├── package.json
├── biome.json            # Linting/formatting config
└── AGENTS.md             # Agent instructions
```

## Commands

```bash
bun test          # Run tests
bun run build     # Compile src/index.ts → dist/index.js
bun run check     # Lint + format check (Biome)
bun run lint      # Lint only
bun run format    # Format and fix
```
