import { computeLineHash } from "./hash-computation"

export function toHashlineContent(content: string): string {
  if (!content) return content
  const lines = content.split("\n")
  const lastLine = lines[lines.length - 1]
  const hasTrailingNewline = lastLine === ""
  const contentLines = hasTrailingNewline ? lines.slice(0, -1) : lines
  const hashlined = contentLines.map((line, i) => {
    const lineNum = i + 1
    const hash = computeLineHash(lineNum, line)
    return `${lineNum}#${hash}|${line}`
  })
  return hasTrailingNewline ? `${hashlined.join("\n")}\n` : hashlined.join("\n")
}

/**
 * Custom unified diff generator — replaces `createTwoFilesPatch` from npm `diff`.
 * Uses a simple LCS-based approach to produce standard unified diff output.
 */
export function generateUnifiedDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): string {
  const oldLines = oldContent.split("\n")
  const newLines = newContent.split("\n")

  // Compute LCS table
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to get diff operations
  const ops: Array<{ type: "equal" | "delete" | "insert"; oldIdx?: number; newIdx?: number }> = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: "equal", oldIdx: i - 1, newIdx: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "insert", newIdx: j - 1 })
      j--
    } else {
      ops.push({ type: "delete", oldIdx: i - 1 })
      i--
    }
  }
  ops.reverse()

  // Group into hunks with context
  const CONTEXT = 3
  const hunks: Array<{
    oldStart: number
    oldCount: number
    newStart: number
    newCount: number
    lines: string[]
  }> = []

  let currentHunk: (typeof hunks)[0] | null = null
  let lastDiffEnd = -1

  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]
    if (op.type === "equal") {
      continue
    }

    // Found a diff — determine hunk boundaries
    const diffStart = k
    let diffEnd = k
    while (diffEnd + 1 < ops.length && ops[diffEnd + 1].type !== "equal") {
      diffEnd++
    }

    const contextStart = Math.max(0, diffStart - CONTEXT)
    const contextEnd = Math.min(ops.length - 1, diffEnd + CONTEXT)

    // Calculate old/new positions at contextStart
    let hunkOldStart = 0
    let hunkNewStart = 0
    for (let x = 0; x < contextStart; x++) {
      if (ops[x].type === "equal" || ops[x].type === "delete") hunkOldStart++
      if (ops[x].type === "equal" || ops[x].type === "insert") hunkNewStart++
    }

    // Check if we should merge with previous hunk
    if (currentHunk && contextStart <= lastDiffEnd + CONTEXT + 1) {
      // Extend current hunk
      let extOld = hunkOldStart
      let extNew = hunkNewStart
      for (let x = lastDiffEnd + 1; x <= contextEnd; x++) {
        const xOp = ops[x]
        if (xOp.type === "equal") {
          currentHunk.lines.push(` ${oldLines[extOld]}`)
          extOld++
          extNew++
          currentHunk.oldCount++
          currentHunk.newCount++
        } else if (xOp.type === "delete") {
          currentHunk.lines.push(`-${oldLines[extOld]}`)
          extOld++
          currentHunk.oldCount++
        } else if (xOp.type === "insert") {
          currentHunk.lines.push(`+${newLines[extNew]}`)
          extNew++
          currentHunk.newCount++
        }
      }
    } else {
      // Start new hunk
      currentHunk = {
        oldStart: hunkOldStart + 1,
        oldCount: 0,
        newStart: hunkNewStart + 1,
        newCount: 0,
        lines: [],
      }

      let extOld = hunkOldStart
      let extNew = hunkNewStart
      for (let x = contextStart; x <= contextEnd; x++) {
        const xOp = ops[x]
        if (xOp.type === "equal") {
          currentHunk.lines.push(` ${oldLines[extOld]}`)
          extOld++
          extNew++
          currentHunk.oldCount++
          currentHunk.newCount++
        } else if (xOp.type === "delete") {
          currentHunk.lines.push(`-${oldLines[extOld]}`)
          extOld++
          currentHunk.oldCount++
        } else if (xOp.type === "insert") {
          currentHunk.lines.push(`+${newLines[extNew]}`)
          extNew++
          currentHunk.newCount++
        }
      }

      hunks.push(currentHunk)
    }

    lastDiffEnd = diffEnd
    k = diffEnd
  }

  if (hunks.length === 0) return ""

  const parts: string[] = []
  parts.push(`--- ${filePath}`)
  parts.push(`+++ ${filePath}`)

  for (const hunk of hunks) {
    parts.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`)
    parts.push(...hunk.lines)
  }

  return `${parts.join("\n")}\n`
}

export function countLineDiffs(
  oldContent: string,
  newContent: string,
): { additions: number; deletions: number } {
  const oldLines = oldContent.split("\n")
  const newLines = newContent.split("\n")

  const oldSet = new Map<string, number>()
  for (const line of oldLines) {
    oldSet.set(line, (oldSet.get(line) ?? 0) + 1)
  }

  const newSet = new Map<string, number>()
  for (const line of newLines) {
    newSet.set(line, (newSet.get(line) ?? 0) + 1)
  }

  let deletions = 0
  for (const [line, count] of oldSet) {
    const newCount = newSet.get(line) ?? 0
    if (count > newCount) {
      deletions += count - newCount
    }
  }

  let additions = 0
  for (const [line, count] of newSet) {
    const oldCount = oldSet.get(line) ?? 0
    if (count > oldCount) {
      additions += count - oldCount
    }
  }

  return { additions, deletions }
}
