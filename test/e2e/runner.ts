import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { getFixture } from "../helpers/fixtures"
import { createRunLogger } from "../helpers/logger"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir } from "../helpers/tmp-dir"
import type {
  LoadedHooks,
  RunE2EOptions,
  RunResult,
  ScenarioStep,
  ScenarioStepContext,
  StepResult,
} from "./types"

function isDeterministic(): boolean {
  return process.env.BYTES_TEST_DETERMINISTIC === "1"
}

function newRunId(): string {
  if (isDeterministic()) return "det-run"
  // Simple time+random id; not security-sensitive.
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowMs(): number {
  return isDeterministic() ? 0 : Date.now()
}

function tsNow(): string | null {
  return isDeterministic() ? null : new Date().toISOString()
}

function defaultArtifactRoot(): string {
  // Anchor to this file's directory so the path is stable regardless of cwd.
  return path.join(import.meta.dir, "artifacts")
}

function normalizeError(err: unknown): { message: string; name: string } {
  if (err instanceof Error) {
    return { message: err.message, name: err.name }
  }
  return { message: String(err), name: "NonError" }
}

/**
 * Dispatches a single step, returning its output. When the step provides an
 * `invoke` callback we use it; otherwise we auto-dispatch against hooks[hook].
 *
 * Hooks can be either callables (e.g. `config`, `chat.params`) or static
 * registries/values (e.g. `tool`). Both shapes are supported.
 */
async function runStep(
  hooks: LoadedHooks,
  step: ScenarioStep,
  ctx: ScenarioStepContext,
): Promise<unknown> {
  if (step.invoke) {
    return await step.invoke(hooks, ctx)
  }

  const hooksRecord = hooks as unknown as Record<string, unknown>
  const target = hooksRecord[step.hook]
  if (target === undefined) {
    throw new Error(`Hook not present on loaded plugin: ${step.hook}`)
  }
  if (typeof target === "function") {
    return await (target as (input: unknown) => unknown)(step.input ?? {})
  }
  return target
}

/**
 * Run an E2E scenario end-to-end through the plugin pipeline.
 *
 * The runner:
 *   1. Emits a greet banner via the A5 logger.
 *   2. Creates a tmp OpenCode config dir, copies the named fixture, and
 *      loads BlackbytesPlugin via the A3 harness (src/index.ts — never dist).
 *   3. Executes each step, writing one NDJSON entry per step to
 *      <artifactDir>/run.ndjson.
 *   4. Calls logger.summary on completion and returns RunResult.
 *
 * Never calls process.exit. On failure it returns RunResult with
 * success=false plus failureStepIndex / failureError populated.
 *
 * When BYTES_TEST_DETERMINISTIC=1 the runId is fixed ('det-run'),
 * timestamps are null, and durations are 0 so two consecutive runs produce
 * byte-identical NDJSON.
 */
export async function runE2EScenario(opts: RunE2EOptions): Promise<RunResult> {
  const runId = newRunId()
  const artifactRoot = opts.artifactRoot ?? defaultArtifactRoot()
  const artifactDir = path.join(artifactRoot, runId)
  mkdirSync(artifactDir, { recursive: true })
  const ndjsonPath = path.join(artifactDir, "run.ndjson")
  // Truncate so deterministic reruns don't accumulate.
  writeFileSync(ndjsonPath, "", "utf-8")

  const logger = createRunLogger({ runId, artifactDir })
  logger.greet(`E2E: ${opts.scenario}`)

  const tmp = makeTmpDir("oc-bb-e2e-")
  const configDir = tmp.path
  const stepResults: StepResult[] = []
  let success = true
  let failureStepIndex: number | undefined
  let failureError: { message: string; name: string } | undefined
  const runStart = nowMs()

  try {
    // Stage the fixture as oc-blackbytes.jsonc inside the tmp config dir.
    const fixtureContent = getFixture(opts.fixture)
    writeFileSync(path.join(configDir, "oc-blackbytes.jsonc"), fixtureContent, "utf-8")

    // Load the plugin via the A3 harness — imports src/index.ts, not dist.
    const hooks = (await loadPlugin({
      configDir,
      directory: configDir,
      worktree: configDir,
      client: opts.client,
    })) as LoadedHooks

    const stepCtx: ScenarioStepContext = { tmpDir: configDir, configDir, runId }

    for (let i = 0; i < opts.steps.length; i++) {
      const step = opts.steps[i]
      if (!step) continue
      logger.step(step.name, { hook: step.hook, index: i })
      const stepStart = nowMs()
      let output: unknown
      let ok = true
      let err: { message: string; name: string } | undefined
      try {
        output = await runStep(hooks, step, stepCtx)
      } catch (caught) {
        ok = false
        err = normalizeError(caught)
      }
      const durationMs = isDeterministic() ? 0 : Math.max(0, nowMs() - stepStart)

      const entry: StepResult = {
        runId,
        scenario: opts.scenario,
        stepIndex: i,
        stepName: step.name,
        hook: step.hook,
        ts: tsNow(),
        durationMs,
        ok,
        ...(ok ? { output } : {}),
        ...(err ? { error: err } : {}),
      }
      stepResults.push(entry)
      // Use ordered keys via JSON.stringify on a pre-built record.
      writeFileSync(ndjsonPath, `${JSON.stringify(entry)}\n`, { encoding: "utf-8", flag: "a" })

      if (!ok) {
        success = false
        failureStepIndex = i
        failureError = err
        logger.failure(err ?? { message: "unknown", name: "Error" })
        break
      }
      logger.success(step.name)
    }
  } catch (bootstrapErr) {
    // Pre-step failure (fixture load, plugin load, etc.). Record as a synthetic
    // step entry at index = current length so the NDJSON stays non-empty and
    // the failure is visible.
    success = false
    const err = normalizeError(bootstrapErr)
    const entry: StepResult = {
      runId,
      scenario: opts.scenario,
      stepIndex: stepResults.length,
      stepName: "__bootstrap__",
      hook: "__bootstrap__",
      ts: tsNow(),
      durationMs: 0,
      ok: false,
      error: err,
    }
    stepResults.push(entry)
    writeFileSync(ndjsonPath, `${JSON.stringify(entry)}\n`, { encoding: "utf-8", flag: "a" })
    failureStepIndex = entry.stepIndex
    failureError = err
    logger.failure(bootstrapErr)
  } finally {
    await tmp.cleanup()
    logger.summary()
  }

  const durationMs = isDeterministic() ? 0 : Math.max(0, nowMs() - runStart)

  return {
    runId,
    scenario: opts.scenario,
    steps: stepResults,
    success,
    durationMs,
    artifactDir,
    ...(failureStepIndex !== undefined ? { failureStepIndex } : {}),
    ...(failureError ? { failureError } : {}),
  }
}

export type { RunE2EOptions, RunResult, ScenarioStep, StepResult } from "./types"
