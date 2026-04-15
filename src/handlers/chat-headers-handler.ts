import type { Hooks } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "../config"
import { log } from "../shared"

function isCopilotProvider(providerID: string): boolean {
  return providerID === "github-copilot" || providerID === "github-copilot-enterprise"
}

export function handleChatHeaders(_: OcBlackbytesConfig): Hooks {
  return {
    "chat.headers": async (input, output) => {
      log("Handling chat headers for provider:", input.model.providerID)
      const api = input.model?.api
      if (api?.npm === "@ai-sdk/github-copilot") return

      if (!isCopilotProvider(input.model.providerID)) return
      output.headers["x-initiator"] = "agent"
    },
  }
}
