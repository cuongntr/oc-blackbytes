import { describe, expect, it } from "bun:test"
import {
  createAgentToolRestrictions,
  type PermissionFormat,
  type PermissionValue,
} from "../../src/extensions/agents/utils/permission-compat"

describe("createAgentToolRestrictions", () => {
  it("returns an object with a permission map", () => {
    const result = createAgentToolRestrictions(["write", "edit"])
    expect(result).toHaveProperty("permission")
    expect(typeof result.permission).toBe("object")
  })

  it("maps each denied tool to 'deny'", () => {
    const denyTools = ["write", "edit", "apply_patch"]
    const result = createAgentToolRestrictions(denyTools)

    for (const tool of denyTools) {
      expect(result.permission[tool]).toBe("deny")
    }
  })

  it("returns an empty permission map for empty array", () => {
    const result = createAgentToolRestrictions([])
    expect(result.permission).toEqual({})
  })

  it("handles a single tool", () => {
    const result = createAgentToolRestrictions(["compress"])
    expect(result.permission).toEqual({ compress: "deny" })
  })

  it("handles wildcard-style tool names (passes through as-is)", () => {
    const result = createAgentToolRestrictions(["*", "bash:*"])
    expect(result.permission["*"]).toBe("deny")
    expect(result.permission["bash:*"]).toBe("deny")
  })

  it("all values are 'deny' (never 'allow' or 'ask')", () => {
    const tools = ["a", "b", "c", "d"]
    const result = createAgentToolRestrictions(tools)
    for (const value of Object.values(result.permission)) {
      expect(value).toBe("deny")
    }
  })

  it("does not include tools not in the deny list", () => {
    const result = createAgentToolRestrictions(["write"])
    expect("read" in result.permission).toBe(false)
    expect("edit" in result.permission).toBe(false)
  })

  it("satisfies PermissionFormat type shape", () => {
    const result: PermissionFormat = createAgentToolRestrictions(["write"])
    expect(result).toBeDefined()
    // permission values are PermissionValue union
    const val: PermissionValue = result.permission.write
    expect(["ask", "allow", "deny"]).toContain(val)
  })

  it("can merge with additional allow/ask permissions (spread pattern)", () => {
    const restrictions = createAgentToolRestrictions(["write", "edit"])
    const merged = {
      ...restrictions.permission,
      read: "allow" as PermissionValue,
      bash: "ask" as PermissionValue,
    }

    expect(merged.write).toBe("deny")
    expect(merged.edit).toBe("deny")
    expect(merged.read).toBe("allow")
    expect(merged.bash).toBe("ask")
  })

  it("duplicate tools in input produce a single deny entry", () => {
    const result = createAgentToolRestrictions(["write", "write", "write"])
    const denyCount = Object.values(result.permission).filter((v) => v === "deny").length
    // Object.fromEntries deduplicates — last write wins, still 'deny'
    expect(denyCount).toBe(1)
    expect(result.permission.write).toBe("deny")
  })
})
