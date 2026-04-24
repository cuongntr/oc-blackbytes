import type { CommandDefinition } from "./types"

export const setupLsp: CommandDefinition = {
  description: "Set up OpenCode core LSP support safely",
  agent: "bytes",
  template: `You are running the /setup-lsp command. Your job is to help the user enable OpenCode's experimental built-in core \`lsp\` tool safely.

This configures OpenCode itself, not the oc-blackbytes plugin. Do not edit \`oc-blackbytes.jsonc\` for this task, and do not describe \`lsp\` as an oc-blackbytes bundled tool.

## Step 1: Explain Scope and Experimental Status

Tell the user that OpenCode core LSP support is experimental and requires starting OpenCode with one of these environment flags before a restart/new process:

\`\`\`sh
OPENCODE_EXPERIMENTAL_LSP_TOOL=true
\`\`\`

or the broader experimental flag:

\`\`\`sh
OPENCODE_EXPERIMENTAL=true
\`\`\`

If the user wants to avoid OpenCode auto-downloading language server binaries, mention:

\`\`\`sh
OPENCODE_DISABLE_LSP_DOWNLOAD=true
\`\`\`

Make clear that changing environment variables from this command cannot enable LSP in an already-running OpenCode process; the user must restart or launch a new process with the flag set.

## Step 2: Locate OpenCode Config

Locate the user's OpenCode config directory using this order:

1. \`OPENCODE_CONFIG_DIR\`, if it is set.
2. The standard config location, typically \`~/.config/opencode/\` on Linux.

Inspect all supported global OpenCode config files if present:

\`\`\`sh
ls "\${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"/config.json "\${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"/opencode.json "\${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"/opencode.jsonc 2>/dev/null
\`\`\`

OpenCode global config is loaded from \`config.json\`, then \`opencode.json\`, then \`opencode.jsonc\`; later files override overlapping keys. If multiple files exist in the same config location, stop and ask the user which file to update before editing. Safe default: update the highest-precedence existing file that already contains related \`permission\` or \`lsp\` settings, or recommend using one format per directory to avoid precedence confusion.

## Step 3: Read Before Editing

Read the selected \`config.json\`, \`opencode.jsonc\`, or \`opencode.json\` before proposing changes. Preserve existing fields such as \`permission\`, \`lsp\`, \`agent\`, \`mcp\`, and plugin-related config.

If no OpenCode config file exists, propose creating \`opencode.jsonc\` in the resolved config directory after the user confirms the target path.

Prefer advisory output first. Do not write changes until the user explicitly confirms the target file and approves editing.

When editing JSONC, preserve comments and formatting where possible. Avoid lossy rewrites; if a precise merge is not possible, show a patch or full proposed replacement and ask before applying it.

## Step 4: Recommend Minimal OpenCode Config

For tool permission, merge this into the OpenCode config:

\`\`\`jsonc
{
  "permission": {
    "lsp": "allow"
  }
}
\`\`\`

If the user needs a custom language server, show this optional OpenCode \`lsp\` config shape and adapt it to their language/server:

\`\`\`jsonc
{
  "lsp": {
    "custom-lsp": {
      "command": ["custom-lsp-server", "--stdio"],
      "extensions": [".custom"]
    }
  }
}
\`\`\`

Supported server entry fields include \`command\`, \`extensions\`, \`disabled\`, \`env\`, and \`initialization\`. Do not include hard-coded line/character coordinate examples in the config; coordinates are only relevant when calling the \`lsp\` tool.

## Step 5: Summarize and Verify

After any approved change, summarize:

- Which OpenCode config file was inspected, edited, or created.
- Whether \`permission.lsp = "allow"\` was added or already present.
- Whether any \`lsp\` server entries were added or left unchanged.
- Which environment flag the user must set before restarting OpenCode.
- Fallbacks if \`lsp\` is unavailable: \`glob\`, \`grep\`, \`ast_grep_search\`, and \`read\`.

Do not introduce a new config editor subsystem. This command is a safe guided setup workflow for OpenCode core LSP support.`,
}
