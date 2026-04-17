import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const CONFIGS_DIR = path.join(import.meta.dir, "configs")

export function getFixturePath(name: string): string {
  return path.join(CONFIGS_DIR, `${name}.jsonc`)
}

export function getFixture(name: string): string {
  const fixturePath = getFixturePath(name)
  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${name} (looked at ${fixturePath})`)
  }
  return readFileSync(fixturePath, "utf-8")
}
