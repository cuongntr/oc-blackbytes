import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { type ParseError, parse, printParseErrorCode } from "jsonc-parser"
import { CONFIG_BASENAME } from "../constants"

export interface JsoncParseResult<T> {
  data: T | null
  errors: Array<{ message: string; offset: number; length: number }>
}

// Removes UTF-8 BOM from a string, if present, to ensure clean processing of text
function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

// Parses a JSONC (JSON with comments) string into an object of type T, throwing detailed errors on syntax issues
export function parseJsonc<T = unknown>(content: string): T {
  // Strip UTF-8 BOM if present (Windows UTF-8 with BOM files)
  content = content.replace(/^\uFEFF/, "")

  const errors: ParseError[] = []
  const result = parse(stripBom(content), errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as T

  if (errors.length > 0) {
    const errorMessages = errors
      .map((e) => `${printParseErrorCode(e.error)} at offset ${e.offset}`)
      .join(", ")
    throw new SyntaxError(`JSONC parse error: ${errorMessages}`)
  }

  return result
}

// Safely parses a JSONC string into an object of type T, returning a detailed result with data and potential errors
export function parseJsoncSafe<T = unknown>(content: string): JsoncParseResult<T> {
  const errors: ParseError[] = []
  const data = parse(stripBom(content), errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as T | null

  return {
    data: errors.length > 0 ? null : data,
    errors: errors.map((e) => ({
      message: printParseErrorCode(e.error),
      offset: e.offset,
      length: e.length,
    })),
  }
}

// Reads and parses a JSONC file at the given path into an object of type T, returning null if the process fails
export function readJsoncFile<T = unknown>(filePath: string): T | null {
  try {
    const content = readFileSync(filePath, "utf-8")
    return parseJsonc<T>(content)
  } catch {
    return null
  }
}

// Detects the configuration file with the given basePath (checks both .json and .jsonc extensions)
export function detectConfigFile(basePath: string): {
  format: "json" | "jsonc" | "none"
  path: string
} {
  const jsoncPath = `${basePath}.jsonc`
  const jsonPath = `${basePath}.json`

  if (existsSync(jsoncPath)) {
    return { format: "jsonc", path: jsoncPath }
  }
  if (existsSync(jsonPath)) {
    return { format: "json", path: jsonPath }
  }
  return { format: "none", path: jsonPath }
}

// Detects both canonical and legacy plugin configuration files in the specified directory
export function detectPluginConfigFile(dir: string): {
  format: "json" | "jsonc" | "none"
  path: string
} {
  const canonicalResult = detectConfigFile(join(dir, CONFIG_BASENAME))

  if (canonicalResult.format !== "none") {
    return {
      ...canonicalResult,
    }
  }

  return { format: "none", path: join(dir, `${CONFIG_BASENAME}.json`) }
}
