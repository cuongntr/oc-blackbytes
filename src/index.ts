import type { Plugin } from "@opencode-ai/plugin"
import { applyMcpConfig } from "./adapter/pipeline/mcp"
import { loadPluginConfig } from "./config"

type ChatHeadersInput = {
  sessionID: string
  provider: { id: string }
  message: {
    id?: string
    role?: string
  }
}

type ChatHeadersOutput = {
  headers: Record<string, string>
}

const INTERNAL_MARKER_CACHE_LIMIT = 1000
const internalMarkerCache = new Map<string, boolean>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function buildChatHeadersInput(raw: unknown): ChatHeadersInput | null {
  if (!isRecord(raw)) return null

  const sessionID = raw.sessionID
  const provider = raw.provider
  const message = raw.message

  if (typeof sessionID !== "string") return null
  if (!isRecord(provider) || typeof provider.id !== "string") return null
  if (!isRecord(message)) return null

  return {
    sessionID,
    provider: { id: provider.id },
    message: {
      id: typeof message.id === "string" ? message.id : undefined,
      role: typeof message.role === "string" ? message.role : undefined,
    },
  }
}

function isChatHeadersOutput(raw: unknown): raw is ChatHeadersOutput {
  if (!isRecord(raw)) return false
  if (!isRecord(raw.headers)) {
    raw.headers = {}
  }
  return isRecord(raw.headers)
}

function isCopilotProvider(providerID: string): boolean {
  return providerID === "github-copilot" || providerID === "github-copilot-enterprise"
}

export const BlackbytesPlugin: Plugin = async (input) => {
  const pluginConfig = loadPluginConfig(input)

  return {
    config: async (config) => {
      await applyMcpConfig({
        pluginConfig,
        config,
      })
    },
    "chat.headers": async (input, output) => {
      const normalizedInput = buildChatHeadersInput(input)
      if (!normalizedInput) return
      if (!isChatHeadersOutput(output)) return

      if (!isCopilotProvider(normalizedInput.provider.id)) return

      // const model =
      //   isRecord(input) && isRecord((input as Record<string, unknown>).model)
      //     ? ((input as Record<string, unknown>).model as Record<string, unknown>)
      //     : undefined
      // const api = model && isRecord(model.api) ? (model.api as Record<string, unknown>) : undefined
      // if (api?.npm === "@ai-sdk/github-copilot") return

      output.headers["x-initiator"] = "agent"
    },
  }
}

export default BlackbytesPlugin
