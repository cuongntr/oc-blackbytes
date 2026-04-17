import { describe, expect, it } from "bun:test"
import {
  CLI_LANGUAGES,
  DEFAULT_MAX_MATCHES,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_TIMEOUT_MS,
  LANG_EXTENSIONS,
  NAPI_LANGUAGES,
} from "../../src/extensions/tools/ast-grep/language-support"

/**
 * Pinned full language list — update when source adds/removes entries.
 *
 * Branches covered:
 * - One assertion per language in CLI_LANGUAGES (25 languages)
 * - NAPI_LANGUAGES subset validity
 * - LANG_EXTENSIONS coverage per language
 * - Constants have expected values
 */

const EXPECTED_LANGUAGES = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "elixir",
  "go",
  "haskell",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "lua",
  "nix",
  "php",
  "python",
  "ruby",
  "rust",
  "scala",
  "solidity",
  "swift",
  "typescript",
  "tsx",
  "yaml",
] as const

describe("ast-grep language-support", () => {
  describe("CLI_LANGUAGES — full pinned list", () => {
    it("contains exactly the expected 25 languages", () => {
      expect(CLI_LANGUAGES.length).toBe(25)
    })

    // One assertion per language
    it("includes bash", () => expect(CLI_LANGUAGES).toContain("bash"))
    it("includes c", () => expect(CLI_LANGUAGES).toContain("c"))
    it("includes cpp", () => expect(CLI_LANGUAGES).toContain("cpp"))
    it("includes csharp", () => expect(CLI_LANGUAGES).toContain("csharp"))
    it("includes css", () => expect(CLI_LANGUAGES).toContain("css"))
    it("includes elixir", () => expect(CLI_LANGUAGES).toContain("elixir"))
    it("includes go", () => expect(CLI_LANGUAGES).toContain("go"))
    it("includes haskell", () => expect(CLI_LANGUAGES).toContain("haskell"))
    it("includes html", () => expect(CLI_LANGUAGES).toContain("html"))
    it("includes java", () => expect(CLI_LANGUAGES).toContain("java"))
    it("includes javascript", () => expect(CLI_LANGUAGES).toContain("javascript"))
    it("includes json", () => expect(CLI_LANGUAGES).toContain("json"))
    it("includes kotlin", () => expect(CLI_LANGUAGES).toContain("kotlin"))
    it("includes lua", () => expect(CLI_LANGUAGES).toContain("lua"))
    it("includes nix", () => expect(CLI_LANGUAGES).toContain("nix"))
    it("includes php", () => expect(CLI_LANGUAGES).toContain("php"))
    it("includes python", () => expect(CLI_LANGUAGES).toContain("python"))
    it("includes ruby", () => expect(CLI_LANGUAGES).toContain("ruby"))
    it("includes rust", () => expect(CLI_LANGUAGES).toContain("rust"))
    it("includes scala", () => expect(CLI_LANGUAGES).toContain("scala"))
    it("includes solidity", () => expect(CLI_LANGUAGES).toContain("solidity"))
    it("includes swift", () => expect(CLI_LANGUAGES).toContain("swift"))
    it("includes typescript", () => expect(CLI_LANGUAGES).toContain("typescript"))
    it("includes tsx", () => expect(CLI_LANGUAGES).toContain("tsx"))
    it("includes yaml", () => expect(CLI_LANGUAGES).toContain("yaml"))

    it("matches the full pinned expected list exactly", () => {
      const sorted = [...CLI_LANGUAGES].sort()
      const expectedSorted = [...EXPECTED_LANGUAGES].sort()
      expect(sorted).toEqual(expectedSorted)
    })
  })

  describe("NAPI_LANGUAGES — subset of CLI_LANGUAGES", () => {
    it("every NAPI language is also in CLI_LANGUAGES", () => {
      for (const lang of NAPI_LANGUAGES) {
        expect(CLI_LANGUAGES).toContain(lang)
      }
    })

    it("contains html", () => expect(NAPI_LANGUAGES).toContain("html"))
    it("contains javascript", () => expect(NAPI_LANGUAGES).toContain("javascript"))
    it("contains tsx", () => expect(NAPI_LANGUAGES).toContain("tsx"))
    it("contains css", () => expect(NAPI_LANGUAGES).toContain("css"))
    it("contains typescript", () => expect(NAPI_LANGUAGES).toContain("typescript"))
  })

  describe("LANG_EXTENSIONS — coverage per language", () => {
    it("has extension entries for every CLI language", () => {
      for (const lang of CLI_LANGUAGES) {
        expect(
          Object.hasOwn(LANG_EXTENSIONS, lang),
          `Missing extension entry for language: ${lang}`,
        ).toBe(true)
      }
    })

    it("all extension arrays are non-empty", () => {
      for (const [lang, exts] of Object.entries(LANG_EXTENSIONS)) {
        expect(Array.isArray(exts), `${lang}: extensions must be array`).toBe(true)
        expect(exts.length, `${lang}: must have at least one extension`).toBeGreaterThan(0)
      }
    })

    it("all extensions start with a dot", () => {
      for (const [lang, exts] of Object.entries(LANG_EXTENSIONS)) {
        for (const ext of exts) {
          expect(ext.startsWith("."), `${lang}: extension "${ext}" must start with "."`).toBe(true)
        }
      }
    })

    // Spot-check specific mappings
    it("maps typescript to .ts, .cts, .mts", () => {
      expect(LANG_EXTENSIONS.typescript).toContain(".ts")
      expect(LANG_EXTENSIONS.typescript).toContain(".cts")
      expect(LANG_EXTENSIONS.typescript).toContain(".mts")
    })

    it("maps python to .py and .pyi", () => {
      expect(LANG_EXTENSIONS.python).toContain(".py")
      expect(LANG_EXTENSIONS.python).toContain(".pyi")
    })

    it("maps rust to .rs", () => {
      expect(LANG_EXTENSIONS.rust).toContain(".rs")
    })

    it("maps go to .go", () => {
      expect(LANG_EXTENSIONS.go).toContain(".go")
    })
  })

  describe("constants", () => {
    it("DEFAULT_TIMEOUT_MS is 300 seconds (300_000 ms)", () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(300_000)
    })

    it("DEFAULT_MAX_OUTPUT_BYTES is 1MB", () => {
      expect(DEFAULT_MAX_OUTPUT_BYTES).toBe(1 * 1024 * 1024)
    })

    it("DEFAULT_MAX_MATCHES is 500", () => {
      expect(DEFAULT_MAX_MATCHES).toBe(500)
    })
  })
})
