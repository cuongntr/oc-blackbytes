import type { PluginInput } from "@opencode-ai/plugin"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import { assertWithinWorkspace } from "../../../shared/utils"
import { countLineDiffs, generateUnifiedDiff } from "./diff-utils"
import { applyHashlineEditsWithReport } from "./edit-operations"
import { canonicalizeFileText, restoreFileText } from "./file-text-canonicalization"
import { type FormatterClient, runFormattersForFile } from "./formatter-trigger"
import { normalizeHashlineEdits, type RawHashlineEdit } from "./normalize-edits"
import type { HashlineEdit } from "./types"
import { HashlineMismatchError } from "./validation"

interface HashlineEditArgs {
  filePath: string
  edits: RawHashlineEdit[]
  delete?: boolean
  rename?: string
}

type ToolContextWithMetadata = ToolContext & {
  metadata?: (value: unknown) => void
}

const MAX_RESULT_DIFF_LINES = 200

interface SuccessMessageOptions {
  action: "Updated" | "Moved"
  path: string
  previousPath?: string
  editCount: number
  additions: number
  deletions: number
  diff: string
}

function formatInlineCode(value: string): string {
  return `\`${value.replaceAll("`", "\\`")}\``
}

function formatResultDiff(diff: string): {
  content: string
  truncated: boolean
  lineCount: number
} {
  const lines = diff.trimEnd().split("\n")
  if (lines.length <= MAX_RESULT_DIFF_LINES) {
    return { content: diff.trimEnd(), truncated: false, lineCount: lines.length }
  }

  return {
    content: lines.slice(0, MAX_RESULT_DIFF_LINES).join("\n"),
    truncated: true,
    lineCount: lines.length,
  }
}

function formatSuccessMessage(options: SuccessMessageOptions): string {
  const target = formatInlineCode(options.path)
  const actionLine =
    options.action === "Moved" && options.previousPath
      ? `Moved ${formatInlineCode(options.previousPath)} to ${target}`
      : `${options.action} ${target}`
  const editLabel = options.editCount === 1 ? "edit" : "edits"
  const lines = [
    actionLine,
    `Applied ${options.editCount} ${editLabel}: +${options.additions} -${options.deletions}`,
  ]

  if (!options.diff.trim()) {
    return lines.join("\n")
  }

  const resultDiff = formatResultDiff(options.diff)
  lines.push("", "```diff", resultDiff.content, "```")

  if (resultDiff.truncated) {
    lines.push(
      "",
      `Diff truncated at ${MAX_RESULT_DIFF_LINES} of ${resultDiff.lineCount} lines. Run \`git diff -- ${options.path}\` for full changes.`,
    )
  }

  return lines.join("\n")
}

function canCreateFromMissingFile(edits: HashlineEdit[]): boolean {
  if (edits.length === 0) return false
  return edits.every((edit) => (edit.op === "append" || edit.op === "prepend") && !edit.pos)
}

function buildSuccessMeta(
  effectivePath: string,
  beforeContent: string,
  afterContent: string,
  noopEdits: number,
  deduplicatedEdits: number,
) {
  const unifiedDiff = generateUnifiedDiff(beforeContent, afterContent, effectivePath)
  const { additions, deletions } = countLineDiffs(beforeContent, afterContent)
  const beforeLines = beforeContent.split("\n")
  const afterLines = afterContent.split("\n")
  const maxLength = Math.max(beforeLines.length, afterLines.length)
  let firstChangedLine: number | undefined

  for (let index = 0; index < maxLength; index += 1) {
    if ((beforeLines[index] ?? "") !== (afterLines[index] ?? "")) {
      firstChangedLine = index + 1
      break
    }
  }

  return {
    title: effectivePath,
    additions,
    deletions,
    diff: unifiedDiff,
    metadata: {
      filePath: effectivePath,
      path: effectivePath,
      file: effectivePath,
      diff: unifiedDiff,
      additions,
      deletions,
      noopEdits,
      deduplicatedEdits,
      firstChangedLine,
      filediff: {
        file: effectivePath,
        path: effectivePath,
        filePath: effectivePath,
        before: beforeContent,
        after: afterContent,
        additions,
        deletions,
      },
    },
  }
}

export async function executeHashlineEditTool(
  args: HashlineEditArgs,
  context: ToolContext,
  pluginInput?: PluginInput,
): Promise<string> {
  try {
    const metadataContext = context as ToolContextWithMetadata
    const filePath = args.filePath
    const { delete: deleteMode, rename } = args

    if (deleteMode && rename) {
      return "Error: delete and rename cannot be used together"
    }
    if (deleteMode && args.edits.length > 0) {
      return "Error: delete mode requires edits to be an empty array"
    }

    if (!deleteMode && (!args.edits || !Array.isArray(args.edits) || args.edits.length === 0)) {
      return "Error: edits parameter must be a non-empty array"
    }

    // Workspace boundary validation
    await assertWithinWorkspace(filePath, context.directory)
    if (rename) {
      await assertWithinWorkspace(rename, context.directory)
    }

    const edits = deleteMode ? [] : normalizeHashlineEdits(args.edits)

    const file = Bun.file(filePath)
    const exists = await file.exists()
    if (!exists && !deleteMode && !canCreateFromMissingFile(edits)) {
      return `Error: File not found: ${filePath}`
    }

    if (deleteMode) {
      if (!exists) return `Error: File not found: ${filePath}`
      await Bun.file(filePath).delete()
      return `Successfully deleted ${filePath}`
    }

    const rawOldContent = exists ? Buffer.from(await file.arrayBuffer()).toString("utf8") : ""
    const oldEnvelope = canonicalizeFileText(rawOldContent)

    const applyResult = applyHashlineEditsWithReport(oldEnvelope.content, edits)
    const canonicalNewContent = applyResult.content

    if (canonicalNewContent === oldEnvelope.content && !rename) {
      let diagnostic = `No changes made to ${filePath}. The edits produced identical content.`
      if (applyResult.noopEdits > 0) {
        diagnostic += ` No-op edits: ${applyResult.noopEdits}. Re-read the file and provide content that differs from current lines.`
      }
      return `Error: ${diagnostic}`
    }

    const writeContent = restoreFileText(canonicalNewContent, oldEnvelope)

    await Bun.write(filePath, writeContent)

    if (pluginInput?.client) {
      await runFormattersForFile(pluginInput.client as FormatterClient, context.directory, filePath)
      const formattedContent = Buffer.from(await Bun.file(filePath).arrayBuffer()).toString("utf8")
      if (formattedContent !== writeContent) {
        const formattedEnvelope = canonicalizeFileText(formattedContent)
        const formattedMeta = buildSuccessMeta(
          filePath,
          oldEnvelope.content,
          formattedEnvelope.content,
          applyResult.noopEdits,
          applyResult.deduplicatedEdits,
        )
        if (typeof metadataContext.metadata === "function") {
          metadataContext.metadata(formattedMeta)
        }
        if (rename && rename !== filePath) {
          await Bun.write(rename, formattedContent)
          await Bun.file(filePath).delete()
          const movedMeta = buildSuccessMeta(
            rename,
            oldEnvelope.content,
            formattedEnvelope.content,
            applyResult.noopEdits,
            applyResult.deduplicatedEdits,
          )
          return formatSuccessMessage({
            action: "Moved",
            path: rename,
            previousPath: filePath,
            editCount: edits.length,
            additions: movedMeta.additions,
            deletions: movedMeta.deletions,
            diff: movedMeta.diff,
          })
        }
        return formatSuccessMessage({
          action: "Updated",
          path: filePath,
          editCount: edits.length,
          additions: formattedMeta.additions,
          deletions: formattedMeta.deletions,
          diff: formattedMeta.diff,
        })
      }
    }

    if (rename && rename !== filePath) {
      await Bun.write(rename, writeContent)
      await Bun.file(filePath).delete()
    }

    const effectivePath = rename && rename !== filePath ? rename : filePath
    const meta = buildSuccessMeta(
      effectivePath,
      oldEnvelope.content,
      canonicalNewContent,
      applyResult.noopEdits,
      applyResult.deduplicatedEdits,
    )

    if (typeof metadataContext.metadata === "function") {
      metadataContext.metadata(meta)
    }

    if (rename && rename !== filePath) {
      return formatSuccessMessage({
        action: "Moved",
        path: effectivePath,
        previousPath: filePath,
        editCount: edits.length,
        additions: meta.additions,
        deletions: meta.deletions,
        diff: meta.diff,
      })
    }

    return formatSuccessMessage({
      action: "Updated",
      path: effectivePath,
      editCount: edits.length,
      additions: meta.additions,
      deletions: meta.deletions,
      diff: meta.diff,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof HashlineMismatchError) {
      return `Error: hash mismatch - ${message}\nTip: reuse LINE#ID entries from the latest read/edit output, or batch related edits in one call.`
    }
    return `Error: ${message}`
  }
}
