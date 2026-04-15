import { spawn } from "bun"

const DEFAULT_TIMEOUT_MS = 60_000

export interface SpawnResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Spawns a subprocess with timeout, stdout/stderr capture, and zombie prevention.
 */
export async function spawnWithTimeout(
  command: string[],
  options?: {
    cwd?: string
    timeout?: number
    env?: Record<string, string>
  },
): Promise<SpawnResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS

  const proc = spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
    cwd: options?.cwd,
    env: options?.env ? { ...process.env, ...options.env } : undefined,
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      try {
        proc.kill()
        void proc.exited.catch(() => {})
      } catch {}
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)
    proc.exited.then(() => clearTimeout(id)).catch(() => clearTimeout(id))
  })

  const [stdout, stderr, exitCode] = await Promise.race([
    Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]),
    timeoutPromise,
  ])

  return { stdout, stderr, exitCode }
}
