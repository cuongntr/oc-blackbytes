import { which } from "bun"

const FIND_DEFAULT_PATH = "/usr/bin/find"

/**
 * Resolves the system `find` binary path.
 * Falls back to the default path if `which` doesn't find it.
 */
export async function resolveFindCli(): Promise<string> {
  const found = which("find")
  return found ?? FIND_DEFAULT_PATH
}
