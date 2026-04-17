import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import type { FormatterClient } from "../../src/extensions/tools/hashline-edit/formatter-trigger"
import {
  buildFormatterCommand,
  clearFormatterCache,
  resolveFormatters,
} from "../../src/extensions/tools/hashline-edit/formatter-trigger"

function makeClient(config: unknown): FormatterClient {
  return {
    config: {
      get: async () => ({ data: config as Parameters<FormatterClient["config"]["get"]>[0] }),
    },
  }
}

beforeEach(() => {
  clearFormatterCache()
})

afterEach(() => {
  clearFormatterCache()
})

describe("resolveFormatters", () => {
  it("returns empty map when config has no formatter", async () => {
    const client = makeClient({})
    const result = await resolveFormatters(client, "/some/dir")
    expect(result.size).toBe(0)
  })

  it("returns empty map when formatter is false", async () => {
    const client = makeClient({ formatter: false })
    const result = await resolveFormatters(client, "/some/dir")
    expect(result.size).toBe(0)
  })

  it("registers formatters from config.formatter", async () => {
    const client = makeClient({
      formatter: {
        biome: {
          command: ["biome", "format", "--write", "$FILE"],
          extensions: [".ts", ".js"],
        },
      },
    })
    const result = await resolveFormatters(client, "/proj")
    expect(result.has(".ts")).toBe(true)
    expect(result.has(".js")).toBe(true)
    const tsFormatters = result.get(".ts")
    expect(tsFormatters?.length).toBe(1)
    expect(tsFormatters?.[0].command).toEqual(["biome", "format", "--write", "$FILE"])
  })

  it("normalizes extensions without leading dot", async () => {
    const client = makeClient({
      formatter: {
        prettier: {
          command: ["prettier", "--write", "$FILE"],
          extensions: ["ts"],
        },
      },
    })
    const result = await resolveFormatters(client, "/proj")
    expect(result.has(".ts")).toBe(true)
  })

  it("skips disabled formatters", async () => {
    const client = makeClient({
      formatter: {
        biome: {
          disabled: true,
          command: ["biome", "format", "--write", "$FILE"],
          extensions: [".ts"],
        },
      },
    })
    const result = await resolveFormatters(client, "/proj")
    expect(result.size).toBe(0)
  })

  it("skips formatters with no command", async () => {
    const client = makeClient({
      formatter: {
        biome: {
          extensions: [".ts"],
        },
      },
    })
    const result = await resolveFormatters(client, "/proj")
    expect(result.size).toBe(0)
  })

  it("skips formatters with no extensions", async () => {
    const client = makeClient({
      formatter: {
        biome: {
          command: ["biome", "format", "--write", "$FILE"],
        },
      },
    })
    const result = await resolveFormatters(client, "/proj")
    expect(result.size).toBe(0)
  })

  it("registers formatters from experimental.hook.file_edited", async () => {
    const client = makeClient({
      experimental: {
        hook: {
          file_edited: {
            ".ts": [{ command: ["tsc", "--noEmit"] }],
          },
        },
      },
    })
    const result = await resolveFormatters(client, "/proj")
    expect(result.has(".ts")).toBe(true)
    expect(result.get(".ts")?.[0].command).toEqual(["tsc", "--noEmit"])
  })

  it("caches results for the same directory", async () => {
    let callCount = 0
    const client: FormatterClient = {
      config: {
        get: async () => {
          callCount++
          return { data: {} }
        },
      },
    }
    await resolveFormatters(client, "/cached-dir")
    await resolveFormatters(client, "/cached-dir")
    expect(callCount).toBe(1)
  })
})

describe("buildFormatterCommand", () => {
  it("replaces $FILE placeholder with actual file path", () => {
    const cmd = buildFormatterCommand(["biome", "format", "--write", "$FILE"], "/path/to/file.ts")
    expect(cmd).toEqual(["biome", "format", "--write", "/path/to/file.ts"])
  })

  it("replaces multiple $FILE occurrences", () => {
    const cmd = buildFormatterCommand(["echo", "$FILE", "$FILE"], "/foo.ts")
    expect(cmd).toEqual(["echo", "/foo.ts", "/foo.ts"])
  })

  it("returns command unchanged when no $FILE placeholder", () => {
    const cmd = buildFormatterCommand(["biome", "check"], "/foo.ts")
    expect(cmd).toEqual(["biome", "check"])
  })
})
