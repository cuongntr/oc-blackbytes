import type { PluginInput } from "@opencode-ai/plugin"
import { withOpencodeConfigDir } from "./env"

export interface LoadPluginOptions {
  configDir: string
  directory: string
  worktree: string
  client?: unknown
}

export async function loadPlugin(
  opts: LoadPluginOptions,
): Promise<Awaited<ReturnType<typeof import("../../src").default>>> {
  return withOpencodeConfigDir(opts.configDir, async () => {
    const { default: BlackbytesPlugin } = await import("../../src")
    const input = {
      client: opts.client ?? "opencode",
      directory: opts.directory,
      worktree: opts.worktree,
    } as PluginInput
    return BlackbytesPlugin(input)
  })
}
