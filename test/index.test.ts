import { describe, expect, it, mock } from "bun:test"
import { BlackbytesPlugin } from "../src/index"

describe("BlackbytesPlugin", () => {
  it("logs initialization and injects shell env", async () => {
    const log = mock(async () => undefined)
    const plugin = await BlackbytesPlugin({
      // biome-ignore lint/suspicious/noExplicitAny: mock context lacks full SDK types
      client: { app: { log } } as any,
      directory: "/repo",
      worktree: "/",
      // biome-ignore lint/suspicious/noExplicitAny: mock context lacks full SDK types
    } as any)

    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]?.[0]).toEqual({
      body: {
        service: "oc-blackbytes",
        level: "info",
        message: "Plugin initialized",
        extra: {
          directory: "/repo",
          worktree: "/",
        },
      },
    })

    const output = { env: {} as Record<string, string> }
    await plugin["shell.env"]?.({}, output)
    expect(output.env.BLACKBYTES_ENABLED).toBe("1")
  })
})
