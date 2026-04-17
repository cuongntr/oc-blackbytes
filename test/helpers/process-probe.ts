import { spawn } from "node:child_process"

const cache = new Map<string, boolean>()

export async function isBinaryAvailable(name: string): Promise<boolean> {
  if (cache.has(name)) {
    return cache.get(name) as boolean
  }

  const result = await new Promise<boolean>((resolve) => {
    try {
      const child = spawn("which", [name], { stdio: "ignore" })
      child.on("error", () => resolve(false))
      child.on("close", (code) => resolve(code === 0))
    } catch {
      resolve(false)
    }
  })

  cache.set(name, result)
  return result
}

export async function skipIfMissing(name: string): Promise<{ skip: boolean; reason?: string }> {
  const available = await isBinaryAvailable(name)
  if (available) {
    return { skip: false }
  }
  return { skip: true, reason: `binary '${name}' not found on PATH` }
}
