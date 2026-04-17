import { describe, expect, it } from "bun:test"
import { spawn } from "bun"
import { collectProcessOutputWithTimeout } from "../../src/extensions/tools/ast-grep/process-output-timeout"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function spawnNode(code: string) {
  return spawn(["node", "-e", code], {
    stdout: "pipe",
    stderr: "pipe",
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("collectProcessOutputWithTimeout", () => {
  it("resolves with stdout, empty stderr, and exitCode 0 for normal exit", async () => {
    const proc = spawnNode("process.stdout.write('hello'); process.exit(0)")
    const result = await collectProcessOutputWithTimeout(proc, 5000)

    expect(result.stdout).toBe("hello")
    expect(result.stderr).toBe("")
    expect(result.exitCode).toBe(0)
  })

  it("captures stderr and non-zero exitCode", async () => {
    const proc = spawnNode("process.stderr.write('err42'); process.exit(3)")
    const result = await collectProcessOutputWithTimeout(proc, 5000)

    expect(result.stderr).toContain("err42")
    expect(result.exitCode).toBe(3)
  })

  it("rejects with timeout error when process runs too long", async () => {
    const proc = spawnNode("setInterval(()=>{},1000)")
    await expect(collectProcessOutputWithTimeout(proc, 200)).rejects.toThrow(
      "Search timeout after 200ms",
    )
  })

  it("kills the process on timeout so no zombie remains", async () => {
    const proc = spawnNode("setInterval(()=>{},1000)")
    const pid: number = proc.pid

    try {
      await collectProcessOutputWithTimeout(proc, 200)
    } catch {
      // expected timeout rejection
    }

    // Give the OS a moment to reap the child process
    await new Promise((r) => setTimeout(r, 300))

    // process.kill(pid, 0) throws ESRCH when the process no longer exists
    let pidGone = false
    try {
      process.kill(pid, 0)
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      if (err.code === "ESRCH") {
        pidGone = true
      }
    }

    expect(pidGone).toBe(true)
  })
})
