import { describe, expect, it } from "bun:test"
import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2"
import type { OcBlackbytesConfig } from "../src/config"
import { handleMcpConfig } from "../src/handlers/config-handler/mcp-config-handler"
import type { ConfigContext } from "../src/handlers/config-handler/types"

type McpEntry = McpLocalConfig | McpRemoteConfig

function makeCtx(overrides: {
  mcp?: Record<string, McpEntry>
  pluginConfig?: OcBlackbytesConfig
}): ConfigContext {
  return {
    config: {
      mcp: overrides.mcp ?? {},
    } as ConfigContext["config"],
    pluginConfig: overrides.pluginConfig ?? {},
    availableModels: new Map(),
  }
}

const remoteEntry = (url: string, enabled?: boolean): McpRemoteConfig => ({
  type: "remote",
  url,
  ...(enabled !== undefined ? { enabled } : {}),
})

describe("handleMcpConfig", () => {
  it("provisions built-in MCPs (context7, grep_app) when not disabled", () => {
    const ctx = makeCtx({})

    handleMcpConfig(ctx)

    expect(ctx.config.mcp).toHaveProperty("context7")
    expect(ctx.config.mcp).toHaveProperty("grep_app")
  })

  it("provisions websearch with exa by default (no explicit config required)", () => {
    // createWebsearchConfig defaults to exa even without a config object
    const ctx = makeCtx({})

    handleMcpConfig(ctx)

    expect(ctx.config.mcp).toHaveProperty("websearch")
    const ws = ctx.config.mcp?.websearch as McpRemoteConfig
    expect(ws.type).toBe("remote")
    expect(ws.url).toContain("mcp.exa.ai")
  })

  it("provisions websearch with explicit exa provider config", () => {
    const ctx = makeCtx({
      pluginConfig: { websearch: { provider: "exa" } },
    })

    handleMcpConfig(ctx)

    expect(ctx.config.mcp).toHaveProperty("websearch")
    const ws = ctx.config.mcp?.websearch as McpRemoteConfig
    expect(ws.url).toContain("mcp.exa.ai")
  })

  it("removes MCPs listed in disabled_mcps entirely", () => {
    const ctx = makeCtx({
      pluginConfig: {
        websearch: { provider: "exa" },
        disabled_mcps: ["websearch", "context7"],
      },
    })

    handleMcpConfig(ctx)

    expect(ctx.config.mcp).not.toHaveProperty("websearch")
    expect(ctx.config.mcp).not.toHaveProperty("context7")
    // grep_app not disabled — still present
    expect(ctx.config.mcp).toHaveProperty("grep_app")
  })

  it("preserves user-provided MCP configs and merges them with built-ins", () => {
    const ctx = makeCtx({
      mcp: {
        my_custom_mcp: remoteEntry("https://example.com/mcp"),
      },
    })

    handleMcpConfig(ctx)

    expect(ctx.config.mcp).toHaveProperty("my_custom_mcp")
    expect((ctx.config.mcp?.my_custom_mcp as McpRemoteConfig).url).toBe("https://example.com/mcp")
    // Built-ins still present
    expect(ctx.config.mcp).toHaveProperty("context7")
    expect(ctx.config.mcp).toHaveProperty("grep_app")
  })

  it("user-defined MCP takes precedence over built-in when keys collide", () => {
    const customUrl = "https://my-custom-context7.example.com/mcp"
    const ctx = makeCtx({
      mcp: { context7: remoteEntry(customUrl) },
    })

    handleMcpConfig(ctx)

    expect((ctx.config.mcp?.context7 as McpRemoteConfig).url).toBe(customUrl)
  })

  it("preserves explicit user disable (enabled: false) even when not in disabled_mcps", () => {
    const ctx = makeCtx({
      mcp: {
        // context7 explicitly disabled by the user in their MCP config
        context7: remoteEntry("https://context7.com/mcp", false),
      },
      pluginConfig: {
        disabled_mcps: [], // context7 is NOT in the plugin-level disabled list
      },
    })

    handleMcpConfig(ctx)

    // context7 should still be present in the merged config but remain disabled
    expect(ctx.config.mcp).toHaveProperty("context7")
    expect((ctx.config.mcp?.context7 as McpRemoteConfig).enabled).toBe(false)
  })

  it("plugin disabled_mcps removes MCP even when user has configured it", () => {
    const ctx = makeCtx({
      mcp: {
        grep_app: remoteEntry("https://grep.app/mcp"),
      },
      pluginConfig: {
        disabled_mcps: ["grep_app"],
      },
    })

    handleMcpConfig(ctx)

    expect(ctx.config.mcp).not.toHaveProperty("grep_app")
  })

  it("plugin disabled_mcps removes an MCP that was also user-disabled", () => {
    const ctx = makeCtx({
      mcp: {
        context7: remoteEntry("https://context7.com/mcp", false),
      },
      pluginConfig: {
        disabled_mcps: ["context7"],
      },
    })

    handleMcpConfig(ctx)

    // Removed entirely — disabled_mcps wins over user-disabled (enabled: false)
    expect(ctx.config.mcp).not.toHaveProperty("context7")
  })

  it("sets ctx.config.mcp to merged result when initial mcp is undefined", () => {
    const ctx = makeCtx({})
    // Deliberately set mcp to undefined to exercise the fallback path
    ctx.config.mcp = undefined as unknown as ConfigContext["config"]["mcp"]

    handleMcpConfig(ctx)

    expect(ctx.config.mcp).toBeDefined()
    expect(ctx.config.mcp).toHaveProperty("context7")
    expect(ctx.config.mcp).toHaveProperty("grep_app")
  })
})
