/**
 * Runner self-test: invokes runE2EScenario for a smoke scenario and asserts:
 * - RunResult shape (all required fields present and correct types)
 * - Artifact NDJSON file exists and each line parses as valid StepResult
 * - Greet banner was captured in the per-run logger NDJSON
 * - success=true and no failureStepIndex when steps all pass
 *
 * Uses BYTES_TEST_DETERMINISTIC=1 so runId='det-run', ts=null, durationMs=0
 * making two consecutive runs byte-identical.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { makeTmpDir } from "../helpers/tmp-dir"
import { runE2EScenario } from "./runner"
import type { RunResult, StepResult } from "./types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readNdjson(filePath: string): unknown[] {
  const content = readFileSync(filePath, "utf-8")
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe("e2e/runner — self-test", () => {
  let artifactRoot: string
  let cleanup: () => Promise<void>

  beforeEach(() => {
    const tmp = makeTmpDir("oc-bb-e2e-self-")
    artifactRoot = tmp.path
    cleanup = tmp.cleanup
  })

  afterEach(async () => {
    await cleanup()
  })

  // ---------------------------------------------------------------------------
  // Smoke: single config step that reads back the loaded hooks object
  // ---------------------------------------------------------------------------
  it("returns RunResult with success=true for a passing smoke scenario", async () => {
    const result = await runE2EScenario({
      scenario: "smoke-self-test",
      fixture: "minimal",
      artifactRoot,
      steps: [
        {
          name: "config-hook-check",
          hook: "config",
          // Use invoke to call the config hook with an empty input and capture
          // the returned config object.
          invoke: async (hooks) => {
            const configFn = (hooks as Record<string, unknown>).config as (
              input: unknown,
            ) => Promise<unknown>
            return await configFn({})
          },
        },
      ],
    })

    // RunResult shape
    expect(typeof result.runId).toBe("string")
    expect(result.runId.length).toBeGreaterThan(0)
    expect(result.scenario).toBe("smoke-self-test")
    expect(Array.isArray(result.steps)).toBe(true)
    expect(result.success).toBe(true)
    expect(typeof result.durationMs).toBe("number")
    expect(typeof result.artifactDir).toBe("string")

    // No failure fields on success
    expect(result.failureStepIndex).toBeUndefined()
    expect(result.failureError).toBeUndefined()
  })

  it("returns exactly one step result matching the step definition", async () => {
    const result = await runE2EScenario({
      scenario: "smoke-steps",
      fixture: "minimal",
      artifactRoot,
      steps: [
        {
          name: "tool-registry-check",
          hook: "tool",
          // No invoke — auto-dispatches to hooks.tool (the tool registry object)
        },
      ],
    })

    expect(result.steps).toHaveLength(1)

    const step = result.steps[0] as StepResult
    expect(step.runId).toBe(result.runId)
    expect(step.scenario).toBe("smoke-steps")
    expect(step.stepIndex).toBe(0)
    expect(step.stepName).toBe("tool-registry-check")
    expect(step.hook).toBe("tool")
    expect(step.ok).toBe(true)
    expect(step.error).toBeUndefined()
    expect(typeof step.durationMs).toBe("number")
    // ts is string or null
    expect(step.ts === null || typeof step.ts === "string").toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Artifact NDJSON: file exists and each line is valid JSON
  // ---------------------------------------------------------------------------
  it("creates artifact NDJSON file with one entry per step", async () => {
    const result = await runE2EScenario({
      scenario: "ndjson-check",
      fixture: "minimal",
      artifactRoot,
      steps: [
        {
          name: "step-one",
          hook: "tool",
        },
        {
          name: "step-two",
          hook: "chat.headers",
          invoke: async (hooks) => {
            const fn = (hooks as Record<string, unknown>)["chat.headers"] as (
              input: unknown,
            ) => Promise<unknown>
            return await fn({})
          },
        },
      ],
    })

    const ndjsonPath = path.join(result.artifactDir, "run.ndjson")
    expect(existsSync(ndjsonPath)).toBe(true)

    const entries = readNdjson(ndjsonPath) as StepResult[]
    expect(entries).toHaveLength(2)

    // Each entry has the StepResult shape
    for (const entry of entries) {
      expect(typeof entry.runId).toBe("string")
      expect(typeof entry.scenario).toBe("string")
      expect(typeof entry.stepIndex).toBe("number")
      expect(typeof entry.stepName).toBe("string")
      expect(typeof entry.hook).toBe("string")
      expect(typeof entry.ok).toBe("boolean")
      expect(typeof entry.durationMs).toBe("number")
    }

    // stepIndex is sequential
    expect(entries[0]?.stepIndex).toBe(0)
    expect(entries[1]?.stepIndex).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // Deterministic mode: runId='det-run', ts=null, durationMs=0
  // ---------------------------------------------------------------------------
  it("uses deterministic runId and zeroed timestamps under BYTES_TEST_DETERMINISTIC=1", async () => {
    const prev = process.env.BYTES_TEST_DETERMINISTIC
    process.env.BYTES_TEST_DETERMINISTIC = "1"
    try {
      const result = await runE2EScenario({
        scenario: "deterministic",
        fixture: "minimal",
        artifactRoot,
        steps: [{ name: "det-step", hook: "tool" }],
      })

      expect(result.runId).toBe("det-run")
      expect(result.durationMs).toBe(0)

      const step = result.steps[0] as StepResult
      expect(step.ts).toBeNull()
      expect(step.durationMs).toBe(0)
    } finally {
      if (prev === undefined) {
        delete process.env.BYTES_TEST_DETERMINISTIC
      } else {
        process.env.BYTES_TEST_DETERMINISTIC = prev
      }
    }
  })

  // ---------------------------------------------------------------------------
  // Failure scenario: step throws → success=false, failureStepIndex set
  // ---------------------------------------------------------------------------
  it("returns success=false when a step throws", async () => {
    const result: RunResult = await runE2EScenario({
      scenario: "failure-scenario",
      fixture: "minimal",
      artifactRoot,
      steps: [
        {
          name: "failing-step",
          hook: "config",
          invoke: async () => {
            throw new Error("deliberate test failure")
          },
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.failureStepIndex).toBe(0)
    expect(result.failureError).toBeDefined()
    expect(result.failureError?.message).toContain("deliberate test failure")
    expect(result.failureError?.name).toBe("Error")

    // The NDJSON entry for the failing step has ok=false
    const ndjsonPath = path.join(result.artifactDir, "run.ndjson")
    const entries = readNdjson(ndjsonPath) as StepResult[]
    expect(entries).toHaveLength(1)
    expect(entries[0]?.ok).toBe(false)
    expect(entries[0]?.error?.message).toContain("deliberate test failure")
  })

  // ---------------------------------------------------------------------------
  // Steps halt after first failure (runner breaks on ok=false)
  // ---------------------------------------------------------------------------
  it("does not execute subsequent steps after a failure", async () => {
    const executed: string[] = []

    const result = await runE2EScenario({
      scenario: "halt-after-failure",
      fixture: "minimal",
      artifactRoot,
      steps: [
        {
          name: "first-fails",
          hook: "config",
          invoke: async () => {
            executed.push("first")
            throw new Error("first step fails")
          },
        },
        {
          name: "second-should-not-run",
          hook: "tool",
          invoke: async () => {
            executed.push("second")
            return "should not reach"
          },
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(executed).toEqual(["first"])
    expect(result.steps).toHaveLength(1)
  })

  // ---------------------------------------------------------------------------
  // artifactDir is populated in RunResult
  // ---------------------------------------------------------------------------
  it("artifactDir exists on disk after run", async () => {
    const result = await runE2EScenario({
      scenario: "artifact-dir-check",
      fixture: "minimal",
      artifactRoot,
      steps: [{ name: "noop", hook: "tool" }],
    })

    expect(existsSync(result.artifactDir)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Greet banner: logger NDJSON contains a 'greet' kind entry
  // ---------------------------------------------------------------------------
  it("greet banner is captured in the per-run logger NDJSON", async () => {
    const result = await runE2EScenario({
      scenario: "greet-banner-check",
      fixture: "minimal",
      artifactRoot,
      steps: [{ name: "step", hook: "tool" }],
    })

    // The runner creates a logger which writes a per-run logger NDJSON separate
    // from the step run.ndjson. The logger file is named run-<runId>.ndjson.
    const loggerNdjsonPath = path.join(result.artifactDir, `run-${result.runId}.ndjson`)
    expect(existsSync(loggerNdjsonPath)).toBe(true)

    const entries = readNdjson(loggerNdjsonPath) as Array<{ kind: string; title?: string }>
    const greetEntry = entries.find((e) => e.kind === "greet")
    expect(greetEntry).toBeDefined()
    expect(greetEntry?.title).toBe("E2E: greet-banner-check")
  })
})
