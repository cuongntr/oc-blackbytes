import type { PluginInput } from "@opencode-ai/plugin"
import type { ToolDefinition } from "@opencode-ai/plugin/tool"
import type { OcBlackbytesConfig } from "../../config"
import { createAstGrepTools } from "../extensions/tools/ast-grep"
import { createGlobTools } from "../extensions/tools/glob"
import { createGrepTools } from "../extensions/tools/grep"
import { createHashlineEditTool } from "../extensions/tools/hashline-edit"
import { log } from "../shared"

type ToolRegistry = Record<string, ToolDefinition>

/**
 * Collects all plugin tools, filtering out disabled ones.
 * Returns a tool registry suitable for `Hooks.tool`.
 */
export function handleTools(pluginConfig: OcBlackbytesConfig, ctx: PluginInput): ToolRegistry {
  const disabledTools = new Set((pluginConfig.disabled_tools ?? []).map((t) => t.toLowerCase()))

  const registry: ToolRegistry = {}

  const register = (name: string, definition: ToolDefinition): void => {
    if (disabledTools.has(name.toLowerCase())) {
      log(`  Tool disabled by config: ${name}`)
      return
    }
    registry[name] = definition
    log(`  Tool registered: ${name}`)
  }

  log("Registering tools...")

  // Phase 2: Hashline Edit
  if (pluginConfig.hashline_edit !== false) {
    register("hashline_edit", createHashlineEditTool(ctx))
  }

  // Phase 3: AST-Grep
  const astGrepTools = createAstGrepTools(ctx)
  for (const [name, definition] of Object.entries(astGrepTools)) {
    register(name, definition)
  }

  // Phase 4: Enhanced Grep + Glob
  const grepTools = createGrepTools(ctx)
  for (const [name, definition] of Object.entries(grepTools)) {
    register(name, definition)
  }

  const globTools = createGlobTools(ctx)
  for (const [name, definition] of Object.entries(globTools)) {
    register(name, definition)
  }

  const count = Object.keys(registry).length
  log(`  Total tools registered: ${count}`)

  return registry
}
