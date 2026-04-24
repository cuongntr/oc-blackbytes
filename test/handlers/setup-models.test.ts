import { describe, expect, it } from "bun:test"
import { setupModels } from "../../src/extensions/commands/setup-models"
import type { CommandDefinition } from "../../src/extensions/commands/types"

describe("setupModels command shape", () => {
  it("is defined", () => {
    expect(setupModels).toBeDefined()
  })

  it("satisfies the CommandDefinition shape", () => {
    const cmd = setupModels as CommandDefinition
    expect(typeof cmd.template).toBe("string")
    expect(typeof cmd.description).toBe("string")
  })

  it("description is non-empty", () => {
    expect(setupModels.description.length).toBeGreaterThan(0)
  })

  it("description mentions model assignments", () => {
    expect(setupModels.description.toLowerCase()).toMatch(/model/)
  })

  it("template is non-empty", () => {
    expect(setupModels.template.length).toBeGreaterThan(0)
  })

  it("template references /setup-models command", () => {
    expect(setupModels.template).toContain("/setup-models")
  })

  it("template mentions Step 1: Discover Available Models", () => {
    expect(setupModels.template).toContain("Step 1: Discover Available Models")
  })

  it("template mentions agent role assignments", () => {
    expect(setupModels.template).toContain("bytes")
    expect(setupModels.template).toContain("oracle")
    expect(setupModels.template).toContain("explore")
    expect(setupModels.template).toContain("librarian")
    expect(setupModels.template).toContain("general")
    expect(setupModels.template).toContain("reviewer")
  })

  it("agent is 'bytes'", () => {
    expect(setupModels.agent).toBe("bytes")
  })

  it("model field is undefined (no specific model pinned)", () => {
    expect((setupModels as CommandDefinition).model).toBeUndefined()
  })

  it("subtask field is undefined", () => {
    expect((setupModels as CommandDefinition).subtask).toBeUndefined()
  })

  it("template is a string (not a function or object)", () => {
    expect(typeof setupModels.template).toBe("string")
  })
})

describe("CommandDefinition type contract", () => {
  it("CommandDefinition requires template, description (optional agent/model/subtask)", () => {
    // Verify that the type has the right optional/required fields via the actual object
    const minimal: CommandDefinition = {
      template: "some template",
      description: "some description",
    }
    expect(minimal.template).toBe("some template")
    expect(minimal.description).toBe("some description")
    expect(minimal.agent).toBeUndefined()
    expect(minimal.model).toBeUndefined()
    expect(minimal.subtask).toBeUndefined()
  })

  it("CommandDefinition supports all optional fields", () => {
    const full: CommandDefinition = {
      template: "t",
      description: "d",
      agent: "bytes",
      model: "anthropic/claude-opus",
      subtask: true,
    }
    expect(full.agent).toBe("bytes")
    expect(full.model).toBe("anthropic/claude-opus")
    expect(full.subtask).toBe(true)
  })
})
