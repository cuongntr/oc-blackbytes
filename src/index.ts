import type { Plugin } from "@opencode-ai/plugin"
import { log } from "./shared"

function createLogBody(message: string, extra?: Record<string, unknown>) {
  return {
    service: "oc-blackbytes",
    level: "info" as const,
    message,
    extra,
  }
}

export const BlackbytesPlugin: Plugin = async ({ client, directory, worktree }) => {
  // init config context
  log("[oc-blackbytes] Plugin loading", { directory, worktree })
  await client.app.log({
    body: createLogBody("Plugin initialized", { directory, worktree }),
  })

  return {
    "shell.env": async (_input, output) => {
      output.env.BLACKBYTES_ENABLED = "1"
    },
    event: async ({ event }) => {
      await client.app.log({
        body: createLogBody(`Event received: ${event.type}`),
      })
    }
  }
}

export default BlackbytesPlugin
