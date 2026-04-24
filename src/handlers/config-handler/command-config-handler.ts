import type { CommandDefinition } from "../../extensions"
import { createBuiltinCommands } from "../../extensions"
import { log } from "../../shared"
import type { ConfigContext } from "./types"

function isCommandAgentAvailable(ctx: ConfigContext, command: CommandDefinition): boolean {
  if (!command.agent || !ctx.config.agent) return true

  const agent = ctx.config.agent[command.agent]
  return Boolean(agent && !agent.disable)
}

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

    if (!isCommandAgentAvailable(ctx, command)) {
      log(`  [commands] Skipping '${name}': required agent '${command.agent}' is unavailable`)
      continue
    }

    config.command[name] = command
    registered++
  }

  log(`  [commands] Registered ${registered} built-in command(s)`)
}
