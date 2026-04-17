/**
 * Tests for hashline-chunk-formatter.ts
 *
 * The chunk formatter accumulates formatted lines and flushes them into
 * chunks based on maxChunkLines and maxChunkBytes limits.
 */
import { describe, expect, it } from "bun:test"

import { createHashlineChunkFormatter } from "../../src/extensions/tools/hashline-edit/hashline-chunk-formatter"

describe("createHashlineChunkFormatter", () => {
  describe("push — basic accumulation", () => {
    it("returns empty array while below limits", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 10, maxChunkBytes: 1024 })
      const out = fmt.push("1#AB|hello")
      expect(out).toEqual([])
    })

    it("flush returns accumulated lines joined by newline", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 10, maxChunkBytes: 1024 })
      fmt.push("1#AB|line one")
      fmt.push("2#CD|line two")
      const chunk = fmt.flush()
      expect(chunk).toBe("1#AB|line one\n2#CD|line two")
    })

    it("flush returns undefined when nothing was pushed", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 10, maxChunkBytes: 1024 })
      expect(fmt.flush()).toBeUndefined()
    })

    it("flush resets the buffer — second flush returns undefined", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 10, maxChunkBytes: 1024 })
      fmt.push("1#AB|content")
      fmt.flush()
      expect(fmt.flush()).toBeUndefined()
    })
  })

  describe("push — chunk flushing when maxChunkLines is reached", () => {
    it("flushes and yields a chunk when maxChunkLines is exactly reached", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 2, maxChunkBytes: 1024 })
      const out1 = fmt.push("1#AB|line1") // 1 line, no flush yet
      const out2 = fmt.push("2#CD|line2") // hits limit → flush
      expect(out1).toEqual([])
      // After reaching limit the chunk is emitted
      expect(out2).toHaveLength(1)
      expect(out2[0]).toBe("1#AB|line1\n2#CD|line2")
    })

    it("starts a new accumulation after auto-flush", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 2, maxChunkBytes: 1024 })
      fmt.push("1#AB|line1")
      fmt.push("2#CD|line2") // flushes chunk 1
      fmt.push("3#EF|line3") // goes into new buffer
      const chunk = fmt.flush()
      expect(chunk).toBe("3#EF|line3")
    })

    it("returns multiple chunks when many lines overflow repeatedly", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 1, maxChunkBytes: 10240 })
      const results: string[] = []
      for (let i = 1; i <= 4; i++) {
        results.push(...fmt.push(`${i}#AB|x`))
      }
      const last = fmt.flush()
      if (last) results.push(last)
      expect(results).toHaveLength(4)
    })
  })

  describe("push — chunk flushing when maxChunkBytes is reached", () => {
    it("flushes before adding a line that would exceed maxChunkBytes", () => {
      // First line is 10 bytes, limit is 15 bytes total
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 100, maxChunkBytes: 15 })
      const line1 = "1#AB|AAAA" // 9 bytes
      const line2 = "2#CD|BBBBBBBB" // 13 bytes → together with separator = 23, exceeds 15
      const out1 = fmt.push(line1)
      const out2 = fmt.push(line2)
      // line2 triggers a flush of line1 before appending
      expect(out1).toEqual([])
      expect(out2).toHaveLength(1)
      expect(out2[0]).toBe(line1)
    })
  })

  describe("snapshot — small example file", () => {
    it("produces correct hashline format for a 3-line file", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 100, maxChunkBytes: 64 * 1024 })
      const lines = ["1#TW|export function hello() {", "2#AB|  return 42", "3#CD|}"]
      for (const line of lines) fmt.push(line)
      const chunk = fmt.flush()
      expect(chunk).toBe(lines.join("\n"))
    })

    it("handles a single-line file", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 200, maxChunkBytes: 64 * 1024 })
      fmt.push("1#ZZ|const x = 1")
      const chunk = fmt.flush()
      expect(chunk).toBe("1#ZZ|const x = 1")
    })

    it("handles empty formatter — no pushes", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 200, maxChunkBytes: 64 * 1024 })
      expect(fmt.flush()).toBeUndefined()
    })
  })

  describe("push — edge cases", () => {
    it("handles empty string line", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 10, maxChunkBytes: 1024 })
      fmt.push("")
      const chunk = fmt.flush()
      expect(chunk).toBe("")
    })

    it("handles lines with unicode content", () => {
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 10, maxChunkBytes: 64 * 1024 })
      const unicodeLine = "1#AB|// Xử lý dữ liệu 🎉"
      fmt.push(unicodeLine)
      expect(fmt.flush()).toBe(unicodeLine)
    })

    it("counts bytes not characters for limit checks (multibyte unicode)", () => {
      // A 4-byte emoji: 🎉 = 4 bytes
      const emoji = "🎉".repeat(10) // 40 bytes
      const line = `1#AB|${emoji}` // prefix (5) + 40 = 45 bytes
      const fmt = createHashlineChunkFormatter({ maxChunkLines: 100, maxChunkBytes: 50 })
      const out = fmt.push(line)
      // Should not flush yet since 45 < 50
      expect(out).toEqual([])
      const chunk = fmt.flush()
      expect(chunk).toBe(line)
    })
  })
})
