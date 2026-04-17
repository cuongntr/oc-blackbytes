import { describe, expect, it } from "bun:test"
import { withEnv, withOpencodeConfigDir } from "./env"

describe("withEnv", () => {
  it("sets a new key then restores by deleting it", async () => {
    const key = "__TEST_NEW_KEY_ENV__"
    delete process.env[key]

    await withEnv({ [key]: "hello" }, async () => {
      expect(process.env[key]).toBe("hello")
    })

    expect(process.env[key]).toBeUndefined()
  })

  it("overrides existing key then restores original value", async () => {
    const key = "__TEST_EXISTING_KEY_ENV__"
    process.env[key] = "original"

    await withEnv({ [key]: "overridden" }, async () => {
      expect(process.env[key]).toBe("overridden")
    })

    expect(process.env[key]).toBe("original")
    delete process.env[key]
  })

  it("deletes existing key (undefined override) then restores it", async () => {
    const key = "__TEST_DELETE_KEY_ENV__"
    process.env[key] = "exists"

    await withEnv({ [key]: undefined }, async () => {
      expect(process.env[key]).toBeUndefined()
    })

    expect(process.env[key]).toBe("exists")
    delete process.env[key]
  })

  it("restores env even if fn throws", async () => {
    const key = "__TEST_THROW_KEY_ENV__"
    delete process.env[key]

    try {
      await withEnv({ [key]: "set" }, async () => {
        expect(process.env[key]).toBe("set")
        throw new Error("intentional error")
      })
    } catch {
      // expected
    }

    expect(process.env[key]).toBeUndefined()
  })

  it("works with a sync-returning fn", async () => {
    const key = "__TEST_SYNC_KEY_ENV__"
    delete process.env[key]

    const result = await withEnv({ [key]: "sync" }, () => {
      return 42
    })

    expect(result).toBe(42)
    expect(process.env[key]).toBeUndefined()
  })

  it("works with an async fn", async () => {
    const key = "__TEST_ASYNC_KEY_ENV__"
    delete process.env[key]

    const result = await withEnv({ [key]: "async" }, async () => {
      return "done"
    })

    expect(result).toBe("done")
    expect(process.env[key]).toBeUndefined()
  })
})

describe("withOpencodeConfigDir", () => {
  it("sets OPENCODE_CONFIG_DIR and restores on exit", async () => {
    const original = process.env.OPENCODE_CONFIG_DIR

    await withOpencodeConfigDir("/tmp/test-config-dir", async () => {
      expect(process.env.OPENCODE_CONFIG_DIR).toBe("/tmp/test-config-dir")
    })

    expect(process.env.OPENCODE_CONFIG_DIR).toBe(original)
  })
})
