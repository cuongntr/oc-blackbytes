# Configuration Guide

This guide covers all `oc-blackbytes.jsonc` configuration options, recommended model assignments per agent, and example setups for common provider combinations.

## Table of Contents

- [Config file location](#config-file-location)
- [Full config reference](#full-config-reference)
- [Agent overview](#agent-overview)
- [Recommended models per agent](#recommended-models-per-agent)
- [Runtime model parameter adaptation](#runtime-model-parameter-adaptation)
- [Example configurations](#example-configurations)
- [Tips and best practices](#tips-and-best-practices)

## Config file location

Create `oc-blackbytes.jsonc` (or `oc-blackbytes.json`) in the OpenCode config directory:

| Platform | Default path |
|---|---|
| Linux / macOS (CLI) | `~/.config/opencode/oc-blackbytes.jsonc` |
| Linux / macOS (Tauri desktop) | `~/.config/ai.opencode.desktop/oc-blackbytes.jsonc` |
| Windows (CLI) | `%APPDATA%\opencode\oc-blackbytes.jsonc` |

The `OPENCODE_CONFIG_DIR` environment variable overrides the default path.

## Full config reference

```jsonc
{
  // Disable specific built-in MCP servers
  "disabled_mcps": [],            // e.g., ["grep_app", "context7"]

  // Disable specific built-in agents
  "disabled_agents": [],          // e.g., ["oracle", "librarian"]

  // Disable specific hooks
  "disabled_hooks": [],           // e.g., ["chat.headers"]

  // Disable specific bundled tools
  "disabled_tools": [],           // e.g., ["ast_grep_replace"]

  // Enable/disable hashline editing (LINE#ID anchors in read output)
  "hashline_edit": true,

  // Websearch MCP backend
  "websearch": {
    "provider": "exa"             // "exa" (default) or "tavily"
  },

  // Per-agent model overrides (see detailed section below)
  "agents": {
    "oracle": { "model": "openai/o3", "reasoningEffort": "high" },
    "explore": { "model": "google/gemini-2.5-flash" },
    "librarian": { "model": "google/gemini-2.5-flash" },
    "general": { "model": "anthropic/claude-sonnet-4-6" }
  },

  // Reserved for future use
  "model_fallback": false,
  "fallback_models": [],
  "auto_update": false
}
```

### Agent model config fields

| Field | Type | Description |
|---|---|---|
| `model` | `string` | Model identifier in `provider/model` format. For subagents, this sets the model directly. For `bytes`, it only affects prompt variant selection — the actual model is determined by the OpenCode UI. |
| `reasoningEffort` | `string` | Override reasoning effort for OpenAI models: `"low"`, `"medium"`, or `"high"`. |
| `temperature` | `number` | Override temperature (0.0–2.0). Lower = more deterministic, higher = more creative. |

## Agent overview

| Agent | Mode | Role | Capabilities | Cost profile |
|---|---|---|---|---|
| **bytes** | Primary | End-to-end coding agent. Handles implementation, debugging, refactoring, planning, and review. | Full read/write access, tool use, subagent delegation | Varies (uses UI-selected model) |
| **explore** | Subagent | Read-only codebase search. Broad, parallel file discovery. | Read-only: grep, glob, file reading | Should be cheap/fast |
| **oracle** | Subagent | Read-only high-reasoning advisor. Architecture decisions, debugging escalation, self-review. | Read-only: deep analysis, no file writing | Can be expensive (used sparingly) |
| **librarian** | Subagent | Read-only research agent. External libraries, remote repos, documentation lookup. | Read-only: web search, GitHub, docs | Should be cheap/fast |
| **general** | Subagent | Write-capable implementation executor. Multi-file changes, migrations, boilerplate. | Full read/write access, tool use | Mid-tier (bytes scopes work for it) |

## Recommended models per agent

### bytes — Primary agent

**Leave unconfigured** — `bytes` always uses the model selected in the OpenCode UI. Setting `model` for `bytes` only changes which prompt variant is loaded (Claude vs GPT vs Gemini style), not the actual model used.

If you want to change the primary model, set it in `opencode.jsonc`:

```jsonc
// opencode.jsonc
{
  "model": "anthropic/claude-opus-4-6"
}
```

### oracle — Reasoning advisor

Oracle is called for hard problems: architecture decisions, debugging escalation after failed attempts, and self-review of significant changes. It benefits most from strong reasoning capabilities.

**Key principle**: Oracle should ideally use a **different provider** than your primary model to provide a genuine "second opinion" perspective.

| Provider | Recommended model | Notes |
|---|---|---|
| OpenAI | `openai/o3` | Best-in-class reasoning. Pair with `"reasoningEffort": "high"`. |
| OpenAI | `openai/gpt-5.4` | Flagship model with strong reasoning. |
| Anthropic | `anthropic/claude-opus-4-6` | Deep reasoning with extended thinking. |
| Google | `google/gemini-2.5-pro` | Strong reasoning, large context window. |
| DeepSeek | `deepseek/deepseek-r1` | Open-source reasoning model, cost-effective. |

```jsonc
// Example: If bytes uses Claude, set oracle to a different provider
"oracle": { "model": "openai/o3", "reasoningEffort": "high" }

// Example: If bytes uses GPT, set oracle to Claude
"oracle": { "model": "anthropic/claude-opus-4-6" }
```

### explore — Codebase search

Explore runs frequent, parallelizable searches across the codebase. It needs speed and low cost — reasoning power is not important. Multiple explore tasks often fire simultaneously.

| Provider | Recommended model | Notes |
|---|---|---|
| Google | `google/gemini-2.5-flash` | Very fast, cheap, excellent for search tasks. |
| OpenAI | `openai/gpt-4.1-mini` | Fast and cost-effective. |
| OpenAI | `openai/gpt-4.1-nano` | Cheapest OpenAI option for simple search. |
| Anthropic | `anthropic/claude-haiku-3.5` | Fast Claude option. |
| DeepSeek | `deepseek/deepseek-chat` | Very cheap, good for search. |

```jsonc
"explore": { "model": "google/gemini-2.5-flash", "temperature": 0.1 }
```

### librarian — Research agent

Librarian searches external documentation, GitHub repos, and library APIs. Similar cost profile to explore — speed matters more than deep reasoning.

| Provider | Recommended model | Notes |
|---|---|---|
| Google | `google/gemini-2.5-flash` | Fast, cheap, large context for doc reading. |
| OpenAI | `openai/gpt-4.1-mini` | Good balance of speed and comprehension. |
| Anthropic | `anthropic/claude-haiku-3.5` | Fast, good at reading documentation. |
| DeepSeek | `deepseek/deepseek-chat` | Cost-effective for documentation lookup. |

```jsonc
"librarian": { "model": "google/gemini-2.5-flash" }
```

### general — Implementation executor

General executes well-scoped implementation tasks that `bytes` delegates. It needs solid code generation but doesn't need to be a flagship model — `bytes` handles the complex thinking and scoping.

| Provider | Recommended model | Notes |
|---|---|---|
| Anthropic | `anthropic/claude-sonnet-4-6` | Strong coding, good balance of quality and cost. |
| OpenAI | `openai/gpt-4.1` | Reliable code generation, mid-tier pricing. |
| Google | `google/gemini-2.5-pro` | Good coding with large context. |
| DeepSeek | `deepseek/deepseek-chat` | Cost-effective coding model. |

```jsonc
"general": { "model": "anthropic/claude-sonnet-4-6" }
```

## Runtime model parameter adaptation

The `chat.params` hook automatically applies provider-correct parameters at inference time. You don't need to manually configure thinking/reasoning — the plugin handles it based on the actual model being used.

### What happens automatically

| Model family | Automatic behavior |
|---|---|
| **Claude** (Anthropic) | Enables extended thinking with per-agent budget: `bytes` 32K tokens, `oracle` 32K tokens, `general` 16K tokens. Strips incompatible OpenAI options. |
| **GPT** (OpenAI) | Sets reasoning effort per agent: `oracle` → `"high"`, `bytes`/`general` → `"medium"`. Strips incompatible Claude options. |
| **Gemini / Other** | Strips all provider-specific options to avoid errors. |
| **explore / librarian** | No thinking/reasoning is applied regardless of model — speed priority. |

### When to use manual overrides

Use the `agents` config to override defaults when:

- You want oracle to use lower reasoning effort to save cost: `"reasoningEffort": "low"`
- You want a specific agent to use a lower/higher temperature
- You're using a provider where the automatic defaults don't work well

```jsonc
{
  "agents": {
    "oracle": { "model": "openai/o3", "reasoningEffort": "medium" },
    "explore": { "temperature": 0.0 }
  }
}
```

## Example configurations

### Anthropic primary + OpenAI reasoning

Best when: You primarily use Claude but want a different perspective for oracle.

```jsonc
{
  "agents": {
    "oracle": { "model": "openai/o3", "reasoningEffort": "high" },
    "explore": { "model": "anthropic/claude-haiku-3.5" },
    "librarian": { "model": "anthropic/claude-haiku-3.5" },
    "general": { "model": "anthropic/claude-sonnet-4-6" }
  }
}
```

- **bytes**: Claude (from OpenCode UI) — flagship reasoning
- **oracle**: OpenAI o3 — different provider for genuine second opinion
- **explore/librarian**: Claude Haiku — fast and cheap within same provider
- **general**: Claude Sonnet — solid coding, same provider

### OpenAI primary + Anthropic advisor

Best when: You primarily use GPT models.

```jsonc
{
  "agents": {
    "oracle": { "model": "anthropic/claude-opus-4-6" },
    "explore": { "model": "openai/gpt-4.1-mini" },
    "librarian": { "model": "openai/gpt-4.1-mini" },
    "general": { "model": "openai/gpt-4.1" }
  }
}
```

### Multi-provider mix (cost-optimized)

Best when: You have multiple provider API keys and want to minimize cost.

```jsonc
{
  "agents": {
    "oracle": { "model": "deepseek/deepseek-r1" },
    "explore": { "model": "google/gemini-2.5-flash", "temperature": 0.1 },
    "librarian": { "model": "google/gemini-2.5-flash" },
    "general": { "model": "deepseek/deepseek-chat" }
  }
}
```

- **oracle**: DeepSeek R1 — strong reasoning at low cost
- **explore/librarian**: Gemini Flash — extremely fast and cheap
- **general**: DeepSeek Chat — cost-effective coding

### Single provider (Anthropic only)

Best when: You only have an Anthropic API key.

```jsonc
{
  "agents": {
    "oracle": { "model": "anthropic/claude-opus-4-6" },
    "explore": { "model": "anthropic/claude-haiku-3.5" },
    "librarian": { "model": "anthropic/claude-haiku-3.5" },
    "general": { "model": "anthropic/claude-sonnet-4-6" }
  }
}
```

### Single provider (OpenAI only)

Best when: You only have an OpenAI API key.

```jsonc
{
  "agents": {
    "oracle": { "model": "openai/o3", "reasoningEffort": "high" },
    "explore": { "model": "openai/gpt-4.1-mini" },
    "librarian": { "model": "openai/gpt-4.1-mini" },
    "general": { "model": "openai/gpt-4.1" }
  }
}
```

### GitHub Copilot

Best when: You use GitHub Copilot as your provider.

```jsonc
{
  "agents": {
    "oracle": { "model": "github-copilot/claude-opus-4-6" },
    "explore": { "model": "github-copilot/gpt-4.1-mini" },
    "librarian": { "model": "github-copilot/gpt-4.1-mini" },
    "general": { "model": "github-copilot/claude-sonnet-4-6" }
  }
}
```

### Minimal (no agent model overrides)

The plugin works without any agent model configuration. All agents use the default model from your OpenCode config, and the `chat.params` hook still applies correct thinking/reasoning parameters automatically.

```jsonc
{
  "hashline_edit": true,
  "websearch": {
    "provider": "exa"
  }
}
```

## Tips and best practices

1. **Oracle should differ from bytes** — The oracle agent provides a "second opinion" on hard problems. Using the same model as bytes reduces the value of this review. Cross-provider diversity gives you genuinely different reasoning perspectives.

2. **Don't over-spend on explore/librarian** — These agents do simple search and lookup tasks. Flagship models are wasted here. Use the cheapest model that can reliably follow tool-call instructions.

3. **General doesn't need flagship models** — The `bytes` agent scopes and plans work before delegating to `general`. A mid-tier coding model is sufficient since the hard thinking is already done.

4. **Temperature guidance**:
   - `explore`: Lower temperature (0.0–0.2) for deterministic search results
   - `oracle`: Default temperature is fine — reasoning models manage this internally
   - `general`: Default temperature is fine — code generation benefits from some creativity
   - `librarian`: Default temperature is fine

5. **You can configure only some agents** — Any agent without explicit config uses the default model with automatic parameter adaptation. You don't need to configure all five.

6. **Verify with debug logs** — Check `/tmp/oc-blackbytes.log` for `[chat.params]` entries to confirm which model family is detected and what parameters are applied:
   ```
   [chat.params] agent=oracle model=openai/o3 family=openai reasoning=true
   ```

7. **Model names follow OpenCode conventions** — Use the `provider/model` format as shown in your OpenCode provider list. Run `opencode debug config` to see available models.
