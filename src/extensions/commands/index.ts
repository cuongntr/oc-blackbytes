import { review } from "./review"
import { setupModels } from "./setup-models"
import type { CommandDefinition } from "./types"

export type { CommandDefinition }

/**
 * Creates a record of all built-in commands.
 * Each key is the command name as it appears in the OpenCode command palette.
 */
export function createBuiltinCommands(): Record<string, CommandDefinition> {
  return {
    "setup-models": setupModels,
    review,
  }
}
