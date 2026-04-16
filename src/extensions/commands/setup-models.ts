import type { CommandDefinition } from "./types"

export const setupModels: CommandDefinition = {
  description: "Set up optimal model assignments for each agent based on available providers",
  agent: "bytes",
  template: `You are running the /setup-models command. Your job is to help the user configure optimal model assignments for the oc-blackbytes plugin.

## Step 1: Discover Available Models

Run this command to see what models are available:
\`\`\`
opencode models
\`\`\`

## Step 2: Check for Existing Config

Before writing anything, check if the user already has a plugin config file:
\`\`\`
ls ~/.config/opencode/oc-blackbytes.jsonc ~/.config/opencode/oc-blackbytes.json 2>/dev/null
\`\`\`

If a config file already exists, read it first and MERGE your changes with the existing settings — do not discard other fields the user may have configured (like \`disabled_mcps\`, \`disabled_tools\`, etc.).

## Step 3: Analyze & Recommend

Based on the available models, determine the best assignment for each agent role following these guidelines:

### Agent Roles & Requirements

| Agent | Role | Requirements | Ideal Tier |
|-------|------|-------------|------------|
| **bytes** | Primary coding agent | Strong reasoning, large context, code generation | Flagship (user's UI choice — do NOT set a model) |
| **oracle** | Architecture advisor, deep debugging | Highest reasoning, complex analysis | Flagship — different provider than user's primary for diversity |
| **explore** | Codebase search, read-only | Fast, cheap, good tool calling | Small/fast model |
| **librarian** | Documentation research, read-only | Good tool calling, summarization | Small/fast model |
| **general** | Multi-file implementation executor | Strong coding, moderate reasoning | Mid-tier coding model |

### Model Preference (per tier)

**Flagship tier** (oracle): Prefer cross-provider diversity. If user's primary is Claude, prefer GPT for oracle and vice versa.
- claude-opus-4-6, gpt-5.4, gemini-3.1-pro

**Mid-tier** (general): Good coding models, cost-effective.
- claude-sonnet-4-6, gpt-5.4-mini, kimi-k2.5, gemini-3.1-pro

**Small/fast tier** (explore, librarian): Cheapest available with decent tool calling.
- gemini-3-flash, claude-haiku-4-5, gpt-5-nano, minimax-m2.7

### Key Rules
1. **bytes**: Do NOT include in the agents config — it respects the user's UI model selection
2. **oracle**: Pick a flagship from a DIFFERENT provider than the user's likely primary model for diversity
3. **explore & librarian**: Pick the cheapest/fastest available model — they are read-only search agents
4. **general**: Pick a solid mid-tier coding model
5. Only assign models from providers that are actually connected/available
6. Include the provider prefix (e.g., "anthropic/claude-sonnet-4-6", "openai/gpt-5.4")

## Step 4: Generate & Write Config

Write the config as \`oc-blackbytes.jsonc\` (JSONC format — comments are supported) in the OpenCode config directory (the same directory where \`opencode.json\` or \`opencode.jsonc\` lives, typically \`~/.config/opencode/\`).

Use this structure:
\`\`\`jsonc
{
  // Enable model fallback resolution for automatic provider failover
  "model_fallback": true,

  "agents": {
    // bytes is NOT included — it uses whatever model you select in the UI
    "oracle": { "model": "<provider>/<model>" },
    "explore": { "model": "<provider>/<model>" },
    "librarian": { "model": "<provider>/<model>" },
    "general": { "model": "<provider>/<model>" }
  }
}
\`\`\`

If an existing config file was found in Step 2, merge the \`agents\` and \`model_fallback\` fields into it, preserving all other existing fields.

After writing, show a summary table of what was configured and why each model was chosen.

**Important**: If a provider has very few models or only one flagship, prefer not to duplicate the same model across agents. Spread across providers when possible for resilience.`,
}
