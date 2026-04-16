import { afterEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { loadConfigFromPath, loadPluginConfig } from "../src/config"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "oc-blackbytes-config-"))
  tempDirs.push(dir)
  return dir
}

function writeConfigFile(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename)
  writeFileSync(filePath, content, "utf-8")
  return filePath
}

afterEach(() => {
  delete process.env.OPENCODE_CONFIG_DIR

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("config loader", () => {
  it("loads a valid oc-blackbytes jsonc file from a path", () => {
    const dir = createTempDir()
    const configPath = writeConfigFile(
      dir,
      "oc-blackbytes.jsonc",
      `{
        // comments should be allowed
        "disabled_mcps": ["websearch"],
        "hashline_edit": true,
        "websearch": {
          "provider": "exa"
        }
      }`,
    )

    expect(loadConfigFromPath(configPath)).toEqual({
      disabled_mcps: ["websearch"],
      hashline_edit: true,
      websearch: {
        provider: "exa",
      },
    })
  })

  it("returns null for a missing config path", () => {
    expect(loadConfigFromPath("/path/that/does/not/exist/oc-blackbytes.json")).toBeNull()
  })

  it("returns null for schema-invalid config", () => {
    const dir = createTempDir()
    const configPath = writeConfigFile(
      dir,
      "oc-blackbytes.json",
      JSON.stringify({ hashline_edit: "yes" }),
    )

    expect(loadConfigFromPath(configPath)).toBeNull()
  })

  it("prefers oc-blackbytes.jsonc when loading plugin config", () => {
    const dir = createTempDir()
    writeConfigFile(dir, "oc-blackbytes.json", JSON.stringify({ hashline_edit: false }))
    writeConfigFile(dir, "oc-blackbytes.jsonc", `{ "hashline_edit": true }`)

    process.env.OPENCODE_CONFIG_DIR = dir

    const { config, warnings } = loadPluginConfig(
      // biome-ignore lint/suspicious/noExplicitAny: plugin input is unused by this loader
      {} as any,
    )
    expect(config).toEqual({ hashline_edit: true })
    expect(warnings).toEqual([])
  })

  it("returns an empty config when no plugin config file exists", () => {
    process.env.OPENCODE_CONFIG_DIR = createTempDir()

    const { config, warnings } = loadPluginConfig(
      // biome-ignore lint/suspicious/noExplicitAny: plugin input is unused by this loader
      {} as any,
    )
    expect(config).toEqual({})
    expect(warnings.length).toBeGreaterThan(0)
  })
})
