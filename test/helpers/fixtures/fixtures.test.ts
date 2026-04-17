import { describe, expect, it } from "bun:test"
import { loadConfigFromPath } from "../../../src/config/loader"
import { getFixture, getFixturePath } from "./index"

describe("fixtures/index", () => {
  it("getFixturePath returns an absolute path ending in .jsonc", () => {
    const p = getFixturePath("minimal")
    expect(p).toMatch(/configs[/\\]minimal\.jsonc$/)
  })

  it("getFixture returns file contents as a string", () => {
    const contents = getFixture("minimal")
    expect(typeof contents).toBe("string")
    expect(contents.length).toBeGreaterThan(0)
  })

  it("getFixture throws for a nonexistent fixture", () => {
    expect(() => getFixture("nonexistent")).toThrow()
  })

  it("getFixturePath throws for a nonexistent fixture only when getFixture is called", () => {
    // getFixturePath itself never throws — it just returns the path
    const p = getFixturePath("nonexistent")
    expect(typeof p).toBe("string")
  })
})

describe("fixtures — schema-valid fixtures load successfully", () => {
  const validFixtures = [
    "minimal",
    "all-enabled",
    "all-disabled",
    "agent-models",
    "disabled-hashline-edit",
  ]

  for (const name of validFixtures) {
    it(`${name} loads via loadConfigFromPath and returns non-null`, () => {
      const result = loadConfigFromPath(getFixturePath(name))
      expect(result).not.toBeNull()
    })
  }
})

describe("fixtures — malformed fixture", () => {
  it("malformed returns null from loadConfigFromPath", () => {
    const result = loadConfigFromPath(getFixturePath("malformed"))
    expect(result).toBeNull()
  })
})
