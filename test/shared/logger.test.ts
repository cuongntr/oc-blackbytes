import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { getLogFilePath, log } from "../../src/shared/utils/logger"

// The logger writes to a fixed path in os.tmpdir() — get it via the exported helper.
const logFilePath = getLogFilePath()

beforeEach(() => {
  // Clean the log file before each test so we get a fresh slate
  try {
    if (existsSync(logFilePath)) {
      rmSync(logFilePath)
    }
  } catch {
    // best-effort
  }
})

afterEach(() => {
  // Clean up after tests
  try {
    if (existsSync(logFilePath)) {
      rmSync(logFilePath)
    }
  } catch {
    // best-effort
  }
})

function readLogContent(): string {
  if (!existsSync(logFilePath)) return ""
  return readFileSync(logFilePath, "utf-8")
}

describe("log — getLogFilePath", () => {
  it("returns a string path ending in .log", () => {
    expect(typeof logFilePath).toBe("string")
    expect(logFilePath.endsWith(".log")).toBe(true)
  })

  it("path includes the oc-blackbytes identifier", () => {
    expect(logFilePath).toContain("oc-blackbytes")
  })
})

describe("log — buffered writes", () => {
  it("does not throw when called", () => {
    expect(() => log("test message")).not.toThrow()
  })

  it("does not throw when called with data object", () => {
    expect(() => log("msg with data", { key: "value", num: 42 })).not.toThrow()
  })

  it("does not throw when called with undefined data", () => {
    expect(() => log("msg without data", undefined)).not.toThrow()
  })

  it("flushes to file when buffer reaches MAX_BUFFER_SIZE (50 entries)", async () => {
    // Write 50 entries to trigger the auto-flush threshold
    const marker = `flush-threshold-${Date.now()}`
    for (let i = 0; i < 50; i++) {
      log(`${marker}-entry-${i}`)
    }

    // After 50 entries the buffer is flushed synchronously
    const content = readLogContent()
    expect(content).toContain(marker)
  })

  it("log entries contain the message", async () => {
    const marker = `marker-${Date.now()}`
    // Write enough to flush
    for (let i = 0; i < 50; i++) {
      log(i === 0 ? marker : `filler-${i}`)
    }
    const content = readLogContent()
    expect(content).toContain(marker)
  })

  it("log entries contain ISO timestamp prefix", async () => {
    for (let i = 0; i < 50; i++) {
      log(`ts-test-${i}`)
    }
    const content = readLogContent()
    // Each line starts with [2...] (ISO date)
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T/)
  })

  it("log entries contain JSON-serialized data when provided", async () => {
    const obj = { testKey: "testValue" }
    // Write with data, then flush
    log("data-message", obj)
    for (let i = 0; i < 49; i++) {
      log(`filler-${i}`)
    }
    const content = readLogContent()
    expect(content).toContain("testValue")
  })

  it("handles concurrent writes without throwing", async () => {
    const writes = Array.from({ length: 50 }, (_, i) =>
      Promise.resolve().then(() => log(`concurrent-${i}`)),
    )
    await expect(Promise.all(writes)).resolves.toBeDefined()
  })
})

describe("log — graceful error handling", () => {
  it("does not throw when called many times rapidly", () => {
    expect(() => {
      for (let i = 0; i < 200; i++) {
        log(`rapid-${i}`, { index: i })
      }
    }).not.toThrow()
  })

  it("does not throw for empty message", () => {
    expect(() => log("")).not.toThrow()
  })

  it("does not throw for very long message", () => {
    const longMsg = "x".repeat(10_000)
    expect(() => log(longMsg)).not.toThrow()
  })
})
