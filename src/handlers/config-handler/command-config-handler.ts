import { createBuiltinCommands } from "../../extensions"
import { log } from "../../shared"
import type { ConfigContext } from "./types"

/**
 * Registers built-in commands into the OpenCode configuration.
 * Commands are merged with user-defined commands, giving precedence to user definitions.
 */
export function handleCommandConfig(ctx: ConfigContext): void {
  const { config } = ctx

  // Initialize command map if not present
  if (!config.command) {
    config.command = {}
  }

  const builtinCommands = createBuiltinCommands()

  let registered = 0
  for (const [name, command] of Object.entries(builtinCommands)) {
    // User-defined commands take precedence — never overwrite
    if (config.command[name]) {
      log(`  [commands] Skipping '${name}': user-defined override exists`)
      continue
    }

    config.command[name] = command
    registered++
  }

  log(`  [commands] Registered ${registered} built-in command(s)`)
}
