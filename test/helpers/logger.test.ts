import { describe, expect, it } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { withEnv } from "./env"
import { createRunLogger } from "./logger"
import { makeTmpDir } from "./tmp-dir"

describe("createRunLogger", () => {
  it("writes NDJSON with correct structure and returns summary counts", async () => {
    const { path: tmpDir, cleanup } = makeTmpDir("oc-bb-logger-test-")
    try {
      await withEnv({ BYTES_TEST_DETERMINISTIC: "1" }, async () => {
        const logger = createRunLogger({ runId: "test", artifactDir: tmpDir })
        logger.greet("E2E")
        logger.step("step-one")
        logger.step("step-two", { key: "value" })
        logger.success("all good")
        logger.failure(new Error("something failed"))
        const counts = logger.summary()

        const ndjsonPath = path.join(tmpDir, "run-test.ndjson")
        expect(existsSync(ndjsonPath)).toBe(true)

        const lines = readFileSync(ndjsonPath, "utf-8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l))

        expect(lines).toHaveLength(5)
        expect(lines[0].kind).toBe("greet")
        expect(lines[0].title).toBe("E2E")
        expect(lines[0].runId).toBe("test")
        expect(lines[1].kind).toBe("step")
        expect(lines[1].name).toBe("step-one")
        expect(lines[2].kind).toBe("step")
        expect(lines[2].name).toBe("step-two")
        expect(lines[2].details).toEqual({ key: "value" })
        expect(lines[3].kind).toBe("success")
        expect(lines[3].msg).toBe("all good")
        expect(lines[4].kind).toBe("failure")
        expect(lines[4].error).toContain("something failed")

        expect(counts).toEqual({ steps: 2, successes: 1, failures: 1 })

        // greet banner contains plugin name
        expect(lines[0].plugin).toBe("oc-blackbytes")
      })
    } finally {
      await cleanup()
    }
  })

  it("sets ts: 0 in deterministic mode", async () => {
    const { path: tmpDir, cleanup } = makeTmpDir("oc-bb-logger-det-")
    try {
      await withEnv({ BYTES_TEST_DETERMINISTIC: "1" }, async () => {
        const logger = createRunLogger({ runId: "det", artifactDir: tmpDir })
        logger.greet("Det")
        logger.step("a-step")

        const lines = readFileSync(path.join(tmpDir, "run-det.ndjson"), "utf-8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l))

        for (const line of lines) {
          expect(line.ts).toBe(0)
        }
      })
    } finally {
      await cleanup()
    }
  })
})
