import { describe, expect, it } from "bun:test"
import path from "node:path"
import {
  detectExistingConfigDir,
  getOpenCodeConfigDir,
  getOpenCodeConfigPaths,
  isDevBuild,
} from "../../src/shared/opencode/opencode-config-dir"
import { withEnv, withOpencodeConfigDir } from "../helpers/env"
import { makeTmpDir } from "../helpers/tmp-dir"

describe("isDevBuild", () => {
  it("returns false for null/undefined", () => {
    expect(isDevBuild(null)).toBe(false)
    expect(isDevBuild(undefined)).toBe(false)
    expect(isDevBuild("")).toBe(false)
  })

  it("returns true for version containing -dev", () => {
    expect(isDevBuild("1.0.0-dev")).toBe(true)
  })

  it("returns true for version containing .dev", () => {
    expect(isDevBuild("1.0.0.dev")).toBe(true)
  })

  it("returns false for stable version", () => {
    expect(isDevBuild("1.2.3")).toBe(false)
  })
})

describe("getOpenCodeConfigDir — CLI binary", () => {
  it("uses OPENCODE_CONFIG_DIR env override when set", async () => {
    const tmp = makeTmpDir("occ-env-")
    const result = await withOpencodeConfigDir(tmp.path, () =>
      getOpenCodeConfigDir({ binary: "opencode" }),
    )
    expect(result).toBe(tmp.path)
    await tmp.cleanup()
  })

  it("falls back to XDG_CONFIG_HOME/opencode when set", async () => {
    const tmp = makeTmpDir("occ-xdg-")
    const result = await withEnv(
      { OPENCODE_CONFIG_DIR: undefined, XDG_CONFIG_HOME: tmp.path },
      () => getOpenCodeConfigDir({ binary: "opencode" }),
    )
    expect(result).toContain("opencode")
    await tmp.cleanup()
  })

  it("falls back to ~/.config/opencode by default", async () => {
    const result = await withEnv(
      { OPENCODE_CONFIG_DIR: undefined, XDG_CONFIG_HOME: undefined },
      () => getOpenCodeConfigDir({ binary: "opencode" }),
    )
    // May be real-pathed, so just check it ends with the expected suffix
    expect(result).toContain(path.join(".config", "opencode"))
  })
})

describe("getOpenCodeConfigDir — desktop binary", () => {
  it("returns Tauri config dir for desktop when no legacy config", async () => {
    const result = await withEnv({ OPENCODE_CONFIG_DIR: undefined }, () =>
      getOpenCodeConfigDir({ binary: "opencode-desktop", checkExisting: false }),
    )
    // Should point to a Tauri-style path containing the app identifier
    expect(result).toContain("ai.opencode.desktop")
  })

  it("uses dev identifier for dev builds", async () => {
    const result = await withEnv({ OPENCODE_CONFIG_DIR: undefined }, () =>
      getOpenCodeConfigDir({
        binary: "opencode-desktop",
        version: "1.0.0-dev",
        checkExisting: false,
      }),
    )
    expect(result).toContain("ai.opencode.desktop.dev")
  })

  it("falls back to legacy CLI config dir when legacy config exists", async () => {
    const tmp = makeTmpDir("occ-legacy-")
    // Write a fake opencode.json to simulate legacy config
    const { writeFileSync } = await import("node:fs")
    writeFileSync(path.join(tmp.path, "opencode.json"), "{}")

    const result = await withOpencodeConfigDir(tmp.path, () =>
      getOpenCodeConfigDir({ binary: "opencode-desktop", checkExisting: true }),
    )
    expect(result).toBe(tmp.path)
    await tmp.cleanup()
  })
})

describe("getOpenCodeConfigPaths", () => {
  it("returns all expected paths under configDir", async () => {
    const tmp = makeTmpDir("occ-paths-")
    const result = await withOpencodeConfigDir(tmp.path, () =>
      getOpenCodeConfigPaths({ binary: "opencode" }),
    )
    expect(result.configDir).toBe(tmp.path)
    expect(result.configJson).toBe(path.join(tmp.path, "opencode.json"))
    expect(result.configJsonc).toBe(path.join(tmp.path, "opencode.jsonc"))
    expect(result.packageJson).toBe(path.join(tmp.path, "package.json"))
    expect(result.ocbConfig).toContain("oc-blackbytes")
    await tmp.cleanup()
  })
})

describe("detectExistingConfigDir", () => {
  it("returns env dir when config file exists there", async () => {
    const tmp = makeTmpDir("occ-detect-")
    const { writeFileSync } = await import("node:fs")
    writeFileSync(path.join(tmp.path, "opencode.json"), "{}")

    const result = await withOpencodeConfigDir(tmp.path, () => detectExistingConfigDir("opencode"))
    expect(result).toBe(tmp.path)
    await tmp.cleanup()
  })

  it("returns null when no config file found", async () => {
    const tmp = makeTmpDir("occ-detect-none-")
    const result = await withEnv({ OPENCODE_CONFIG_DIR: tmp.path }, () =>
      detectExistingConfigDir("opencode"),
    )
    expect(result).toBeNull()
    await tmp.cleanup()
  })
})
