import type { Hooks } from "@opencode-ai/plugin"

/**
 * Shape of each line in the per-run NDJSON artifact at
 * test/e2e/artifacts/<runId>/run.ndjson.
 *
 * Pinned exactly per bead ocb-3r3.13.1. Do not drift without updating the bead.
 */
export interface StepResult {
  runId: string
  scenario: string
  stepIndex: number
  stepName: string
  hook: string
  /** ISO timestamp, or null when BYTES_TEST_DETERMINISTIC=1. */
  ts: string | null
  /** Step duration in milliseconds. Zeroed under deterministic mode. */
  durationMs: number
  ok: boolean
  output?: unknown
  error?: { message: string; name: string }
}

/**
 * Final return from runE2EScenario. The runner is a library function — it
 * never calls process.exit; callers interpret success themselves.
 */
export interface RunResult {
  runId: string
  scenario: string
  steps: StepResult[]
  success: boolean
  durationMs: number
  /** Absolute path to the per-run artifact directory. */
  artifactDir: string
  /** Index (into steps) of the first failing step, if any. */
  failureStepIndex?: number
  failureError?: { message: string; name: string }
}

/**
 * Context passed to each step's invoke callback. Scenarios use this to
 * reach the sandboxed tmp dir, the resolved OpenCode config dir, and the
 * stable runId.
 */
export interface ScenarioStepContext {
  tmpDir: string
  configDir: string
  runId: string
}

/** A loaded plugin returns a Hooks object. Alias for readability. */
export type LoadedHooks = Hooks

/**
 * Describes a single step in an E2E scenario. Two invocation modes:
 *
 *  - If `invoke` is provided, the runner calls it with (hooks, ctx) and uses
 *    the return value as the step output.
 *  - Otherwise the runner auto-dispatches `hooks[hook]`:
 *      • if callable: called with `input` (defaulting to {}).
 *      • if object (e.g. `tool` registry): used as-is as the output.
 *
 * The `name` is surfaced in NDJSON as `stepName`; `hook` is surfaced as `hook`.
 */
export interface ScenarioStep {
  name: string
  hook: string
  input?: unknown
  invoke?: (hooks: LoadedHooks, ctx: ScenarioStepContext) => unknown | Promise<unknown>
}

export interface RunE2EOptions {
  /** Scenario name surfaced in NDJSON + logger banner. */
  scenario: string
  /**
   * Fixture name (without extension) resolved via test/helpers/fixtures. The
   * runner copies this fixture into <tmpDir>/oc-blackbytes.jsonc before
   * loading the plugin.
   */
  fixture: string
  steps: ScenarioStep[]
  /**
   * Optional override for the artifact root. Defaults to
   * <repo>/test/e2e/artifacts.
   */
  artifactRoot?: string
  /**
   * Optional override for the client passed into the plugin harness.
   * Defaults to the string "opencode".
   */
  client?: unknown
}
