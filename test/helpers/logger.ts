import { appendFileSync, mkdirSync } from "node:fs"
import path from "node:path"

export interface RunLogger {
  greet(title: string): void
  step(name: string, details?: Record<string, unknown>): void
  success(msg: string): void
  failure(err: unknown): void
  summary(): { steps: number; successes: number; failures: number }
}

export interface RunLoggerOptions {
  runId: string
  artifactDir: string
}

function isDeterministic(): boolean {
  return process.env.BYTES_TEST_DETERMINISTIC === "1"
}

function nowTs(): number {
  return isDeterministic() ? 0 : Date.now()
}

function bunVersion(): string {
  try {
    // @ts-expect-error Bun global only available in Bun runtime
    return typeof Bun !== "undefined" ? Bun.version : "n/a"
  } catch {
    return "n/a"
  }
}

export function createRunLogger(opts: RunLoggerOptions): RunLogger {
  const { runId, artifactDir } = opts
  mkdirSync(artifactDir, { recursive: true })
  const ndjsonPath = path.join(artifactDir, `run-${runId}.ndjson`)

  let steps = 0
  let successes = 0
  let failures = 0

  function appendNdjson(obj: Record<string, unknown>): void {
    appendFileSync(ndjsonPath, `${JSON.stringify(obj)}\n`, "utf-8")
  }

  function tsPrefix(): string {
    if (isDeterministic()) return ""
    return `[${new Date().toISOString()}] `
  }

  return {
    greet(title: string): void {
      const nodeVersion = process.versions.node
      const bv = bunVersion()
      const platform = process.platform
      const lines = [
        `  ${title}`,
        `  plugin:   oc-blackbytes`,
        `  runId:    ${runId}`,
        `  node:     ${nodeVersion}`,
        `  bun:      ${bv}`,
        `  platform: ${platform}`,
      ]
      const width = Math.max(...lines.map((l) => l.length)) + 2
      const border = `+${"-".repeat(width)}+`
      const banner = [border, ...lines.map((l) => `|${l.padEnd(width)}|`), border].join("\n")
      process.stdout.write(`${banner}\n`)
      appendNdjson({
        kind: "greet",
        title,
        runId,
        plugin: "oc-blackbytes",
        nodeVersion,
        bun: bv,
        platform,
        ts: nowTs(),
      })
    },

    step(name: string, details?: Record<string, unknown>): void {
      steps++
      process.stdout.write(`${tsPrefix()}STEP: ${name}\n`)
      appendNdjson({ kind: "step", name, details: details ?? null, ts: nowTs() })
    },

    success(msg: string): void {
      successes++
      process.stdout.write(`${tsPrefix()}OK: ${msg}\n`)
      appendNdjson({ kind: "success", msg, ts: nowTs() })
    },

    failure(err: unknown): void {
      failures++
      const errStr = err instanceof Error ? (err.stack ?? err.message) : String(err)
      process.stdout.write(`${tsPrefix()}FAIL: ${errStr}\n`)
      appendNdjson({ kind: "failure", error: String(err), ts: nowTs() })
    },

    summary(): { steps: number; successes: number; failures: number } {
      process.stdout.write(`SUMMARY: steps=${steps} successes=${successes} failures=${failures}\n`)
      return { steps, successes, failures }
    },
  }
}
