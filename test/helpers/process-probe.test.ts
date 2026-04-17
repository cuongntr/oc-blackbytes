import { describe, expect, it } from "bun:test"
import { isBinaryAvailable, skipIfMissing } from "./process-probe"

describe("isBinaryAvailable", () => {
  it("returns true for sh (universally present)", async () => {
    const result = await isBinaryAvailable("sh")
    expect(result).toBe(true)
  })

  it("returns false for a nonexistent binary", async () => {
    const result = await isBinaryAvailable("nonexistent-binary-xyz-123")
    expect(result).toBe(false)
  })

  it("returns consistent result on repeated calls (cache)", async () => {
    const first = await isBinaryAvailable("sh")
    const second = await isBinaryAvailable("sh")
    expect(first).toBe(second)

    const first2 = await isBinaryAvailable("nonexistent-binary-xyz-123")
    const second2 = await isBinaryAvailable("nonexistent-binary-xyz-123")
    expect(first2).toBe(second2)
  })
})

describe("skipIfMissing", () => {
  it("returns { skip: false } when binary is available", async () => {
    const result = await skipIfMissing("sh")
    expect(result).toEqual({ skip: false })
  })

  it("returns { skip: true, reason: string } when binary is missing", async () => {
    const result = await skipIfMissing("nonexistent-binary-xyz-123")
    expect(result.skip).toBe(true)
    expect(result.reason).toBe("binary 'nonexistent-binary-xyz-123' not found on PATH")
  })
})
