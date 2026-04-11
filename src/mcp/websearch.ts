import type { WebsearchConfig } from "../config/schema"
import { log } from "../shared"
import type { RemoteMcpConfig } from "./types"

export function createWebsearchConfig(config?: WebsearchConfig): RemoteMcpConfig | undefined {
  const provider = config?.provider || "exa"

  if (provider === "tavily") {
    const tavilyKey = process.env.TAVILY_API_KEY
    if (!tavilyKey) {
      log("[webseach] Tavily API key not found, skipping websearch MCP")
      return undefined
    }

    return {
      type: "remote" as const,
      url: "https://mcp.tavily.com/mcp/",
      enabled: true,
      headers: {
        Authorization: `Bearer ${tavilyKey}`,
      },
      oauth: false,
    }
  }

  return {
    type: "remote" as const,
    url: process.env.EXA_API_KEY
      ? `https://mcp.exa.ai/mcp?tools=web_search_exa&exaApiKey=${encodeURIComponent(process.env.EXA_API_KEY)}`
      : "https://mcp.exa.ai/mcp?tools=web_search_exa",
    enabled: true,
    oauth: false,
  }
}

export const websearch = createWebsearchConfig()
