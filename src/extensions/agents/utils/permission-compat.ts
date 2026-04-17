/**
 * Permission system utilities for OpenCode 1.1.1+.
 * This module only supports the new permission format.
 */

export type PermissionValue = "ask" | "allow" | "deny"

export interface PermissionFormat {
  permission: Record<string, PermissionValue>
}

/**
 * Creates tool restrictions that deny specified tools.
 */
export function createAgentToolRestrictions(denyTools: string[]): PermissionFormat {
  return {
    permission: Object.fromEntries(denyTools.map((tool) => [tool, "deny" as const])),
  }
}
