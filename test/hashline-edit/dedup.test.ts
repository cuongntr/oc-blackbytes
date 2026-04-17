/**
 * Tests for edit-deduplication.ts
 *
 * dedupeEdits: removes duplicate edits (same op+anchors+lines) while preserving order.
 */
import { describe, expect, it } from "bun:test"

import { dedupeEdits } from "../../src/extensions/tools/hashline-edit/edit-deduplication"
import type { HashlineEdit } from "../../src/extensions/tools/hashline-edit/types"

describe("dedupeEdits — identity (no duplicates)", () => {
  it("empty array returns empty", () => {
    const { edits, deduplicatedEdits } = dedupeEdits([])
    expect(edits).toEqual([])
    expect(deduplicatedEdits).toBe(0)
  })

  it("single edit is kept", () => {
    const edit: HashlineEdit = { op: "replace", pos: "1#AB", lines: ["hello"] }
    const { edits, deduplicatedEdits } = dedupeEdits([edit])
    expect(edits).toHaveLength(1)
    expect(deduplicatedEdits).toBe(0)
  })

  it("two different replace edits — both kept", () => {
    const a: HashlineEdit = { op: "replace", pos: "1#AB", lines: ["line1"] }
    const b: HashlineEdit = { op: "replace", pos: "2#CD", lines: ["line2"] }
    const { edits, deduplicatedEdits } = dedupeEdits([a, b])
    expect(edits).toHaveLength(2)
    expect(deduplicatedEdits).toBe(0)
  })

  it("different ops on same anchor — both kept", () => {
    const a: HashlineEdit = { op: "append", pos: "3#XY", lines: ["appended"] }
    const b: HashlineEdit = { op: "prepend", pos: "3#XY", lines: ["prepended"] }
    const { edits, deduplicatedEdits } = dedupeEdits([a, b])
    expect(edits).toHaveLength(2)
    expect(deduplicatedEdits).toBe(0)
  })
})

describe("dedupeEdits — duplicate detection", () => {
  it("identical replace edits — second removed", () => {
    const edit: HashlineEdit = { op: "replace", pos: "5#HJ", lines: ["same content"] }
    const { edits, deduplicatedEdits } = dedupeEdits([edit, { ...edit }])
    expect(edits).toHaveLength(1)
    expect(deduplicatedEdits).toBe(1)
  })

  it("identical append edits — second removed", () => {
    const edit: HashlineEdit = { op: "append", pos: "2#KL", lines: ["new line"] }
    const { edits, deduplicatedEdits } = dedupeEdits([edit, { ...edit }])
    expect(edits).toHaveLength(1)
    expect(deduplicatedEdits).toBe(1)
  })

  it("identical prepend edits — second removed", () => {
    const edit: HashlineEdit = { op: "prepend", pos: "7#MN", lines: ["prefix"] }
    const { edits, deduplicatedEdits } = dedupeEdits([edit, { ...edit }])
    expect(edits).toHaveLength(1)
    expect(deduplicatedEdits).toBe(1)
  })

  it("replace with end — exact same range duplicated", () => {
    const edit: HashlineEdit = { op: "replace", pos: "1#AB", end: "3#CD", lines: ["rewrite"] }
    const { edits, deduplicatedEdits } = dedupeEdits([edit, { ...edit }])
    expect(edits).toHaveLength(1)
    expect(deduplicatedEdits).toBe(1)
  })

  it("three identical edits — two removed", () => {
    const edit: HashlineEdit = { op: "replace", pos: "1#AB", lines: ["x"] }
    const { edits, deduplicatedEdits } = dedupeEdits([edit, edit, edit])
    expect(edits).toHaveLength(1)
    expect(deduplicatedEdits).toBe(2)
  })

  it("preserves first occurrence order with mixed duplicates", () => {
    const a: HashlineEdit = { op: "replace", pos: "1#AA", lines: ["a"] }
    const b: HashlineEdit = { op: "replace", pos: "2#BB", lines: ["b"] }
    const { edits, deduplicatedEdits } = dedupeEdits([a, b, { ...a }, { ...b }])
    expect(edits).toHaveLength(2)
    expect(edits[0]).toEqual(a)
    expect(edits[1]).toEqual(b)
    expect(deduplicatedEdits).toBe(2)
  })
})

describe("dedupeEdits — lines normalization in key", () => {
  it("string lines vs array-with-one-element — treated as same key", () => {
    const a: HashlineEdit = { op: "replace", pos: "1#AB", lines: "same content" }
    const b: HashlineEdit = { op: "replace", pos: "1#AB", lines: ["same content"] }
    const { edits, deduplicatedEdits } = dedupeEdits([a, b])
    // They should deduplicate since toNewLines normalizes both to same
    expect(deduplicatedEdits).toBe(1)
    expect(edits).toHaveLength(1)
  })

  it("different lines — not deduped", () => {
    const a: HashlineEdit = { op: "replace", pos: "1#AB", lines: ["line A"] }
    const b: HashlineEdit = { op: "replace", pos: "1#AB", lines: ["line B"] }
    const { edits, deduplicatedEdits } = dedupeEdits([a, b])
    expect(edits).toHaveLength(2)
    expect(deduplicatedEdits).toBe(0)
  })
})
