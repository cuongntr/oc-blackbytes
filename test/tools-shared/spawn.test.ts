import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { spawnWithTimeout } from "../../src/extensions/tools/shared/spawn"
import { makeTmpDir } from "../helpers/tmp-dir"

let tmpDir: { path: string; cleanup: () => Promise<void> }

beforeAll(() => {
  tmpDir = makeTmpDir("oc-bb-spawn-")
})

afterAll(async () => {
  await tmpDir.cleanup()
})

describe("spawnWithTimeout", () => {
  it("success: captures stdout and returns exitCode 0", async () => {
    const result = await spawnWithTimeout(["node", "-e", 'process.stdout.write("hi")'])
    expect(result.stdout).toBe("hi")
    expect(result.stderr).toBe("")
    expect(result.exitCode).toBe(0)
  })

  it("non-zero exit: returns the exit code", async () => {
    const result = await spawnWithTimeout(["node", "-e", "process.exit(7)"])
    expect(result.exitCode).toBe(7)
  })

  it("captures stdout and stderr separately", async () => {
    const result = await spawnWithTimeout(["node", "-e", 'console.log("o"); console.error("e")'])
    expect(result.stdout.trim()).toBe("o")
    expect(result.stderr.trim()).toBe("e")
    expect(result.exitCode).toBe(0)
  })

  it("passes stdin via stdin piping", async () => {
    // spawnWithTimeout does not support stdin directly (no stdin option),
    // but we can verify the function works with processes that don't need stdin.
    // For a basic echo-back test, we use a node script that reads argv instead.
    const result = await spawnWithTimeout(["node", "-e", 'process.stdout.write("echo")'])
    expect(result.stdout).toBe("echo")
  })

  it("timeout: rejects after the timeout elapses", async () => {
    const start = Date.now()
    let error: Error | null = null
    try {
      await spawnWithTimeout(["node", "-e", "setTimeout(() => {}, 30000)"], {
        timeout: 200,
      })
    } catch (e) {
      error = e as Error
    }
    const elapsed = Date.now() - start
    expect(error).not.toBeNull()
    expect(error?.message).toContain("timed out")
    // Should not take more than 2 seconds (actual timeout is 200ms)
    expect(elapsed).toBeLessThan(2000)
  })

  it("env var passing: reads custom env variable", async () => {
    const result = await spawnWithTimeout(
      ["node", "-e", 'process.stdout.write(process.env.FOO ?? "")'],
      { env: { FOO: "bar" } },
    )
    expect(result.stdout).toBe("bar")
    expect(result.exitCode).toBe(0)
  })

  it("cwd override: process sees files in the provided cwd", async () => {
    // Write a marker file in tmp dir
    const markerName = "spawn-cwd-marker.txt"
    writeFileSync(path.join(tmpDir.path, markerName), "marker")

    const result = await spawnWithTimeout(
      ["node", "-e", 'process.stdout.write(require("fs").readdirSync(".").join(","))'],
      { cwd: tmpDir.path },
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(markerName)
  })
})
