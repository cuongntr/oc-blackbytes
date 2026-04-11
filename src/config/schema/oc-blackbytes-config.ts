import z from "zod";
import { WebsearchConfigSchema } from "./websearch";
import { AnyMcpNameSchema } from "../../mcp/types";

export const OcBlackbytesConfigSchema = z.object({
  $schema: z.string().optional(),

  disabled_mcps: z.array(AnyMcpNameSchema).optional(),
  disabled_agents: z.array(z.string()).optional(),
  disabled_hooks: z.array(z.string()).optional(),
  /** Disable specific tools by name (e.g., ["totowrite", "todoread"]) */
  disabled_tools: z.array(z.string()).optional(),

  mcp_env_alllowlist: z.array(z.string()).optional(),
  hashlint_edit: z.boolean().optional(),
  model_fallback: z.boolean().optional(),
  auto_update: z.boolean().optional(),
  websearch: WebsearchConfigSchema.optional(),
  _migrations: z.array(z.string()).optional(),
})

export type OcBlackbytesConfig = z.infer<typeof OcBlackbytesConfigSchema>