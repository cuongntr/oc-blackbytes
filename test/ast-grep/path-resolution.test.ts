import { describe, expect, it } from "bun:test"
import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { makeTmpDir } from "../helpers/tmp-dir"

// We test the exported functions from sg-cli-path directly.
// Because findSgCliPathSync() reads from a module-level cache path (getCachedBinaryPath),
// which is hardcoded to the user's real cache dir, we focus on the parts of the API
// that are controllable: setSgCliPath / getSgCliPath / getResolvedSgCliPath.

import {
  getAstGrepPath,
  getResolvedSgCliPath,
  isCliAvailable,
} from "../../src/extensions/tools/ast-grep/cli-binary-path-resolution"
import { getSgCliPath, setSgCliPath } from "../../src/extensions/tools/ast-grep/sg-cli-path"

// ---------------------------------------------------------------------------
// setSgCliPath / getSgCliPath
// ---------------------------------------------------------------------------

describe("setSgCliPath / getSgCliPath", () => {
  it("getSgCliPath returns the path previously set by setSgCliPath", () => {
    const tmp = makeTmpDir("sg-path-test-")
    try {
      const fakeSgPath = join(tmp.path, "sg")
      // Create a real executable file so existsSync passes
      writeFileSync(fakeSgPath, "#!/bin/sh\necho fake-sg", { mode: 0o755 })

      setSgCliPath(fakeSgPath)
      expect(getSgCliPath()).toBe(fakeSgPath)
    } finally {
      void tmp.cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// getResolvedSgCliPath
// ---------------------------------------------------------------------------

describe("getResolvedSgCliPath", () => {
  it("returns null when the stored path does not exist on disk", () => {
    setSgCliPath("/nonexistent/path/to/sg")
    // getResolvedSgCliPath checks existsSync, so it should return null
    const result = getResolvedSgCliPath()
    expect(result).toBeNull()
  })

  it("returns the path when the stored path exists on disk", () => {
    const tmp = makeTmpDir("sg-resolved-")
    try {
      const fakeSgPath = join(tmp.path, "sg")
      writeFileSync(fakeSgPath, "#!/bin/sh\necho fake", { mode: 0o755 })

      setSgCliPath(fakeSgPath)
      expect(getResolvedSgCliPath()).toBe(fakeSgPath)
    } finally {
      void tmp.cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// isCliAvailable
// ---------------------------------------------------------------------------

describe("isCliAvailable", () => {
  it("returns a boolean without throwing", () => {
    const result = isCliAvailable()
    expect(typeof result).toBe("boolean")
  })
})

// ---------------------------------------------------------------------------
// getAstGrepPath (async)
// ---------------------------------------------------------------------------

describe("getAstGrepPath", () => {
  it("returns null or a valid path string", async () => {
    // When sg binary is not installed, this should resolve to null.
    // When it is installed, it should resolve to a non-empty string.
    const result = await getAstGrepPath()
    if (result !== null) {
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
      expect(existsSync(result)).toBe(true)
    } else {
      expect(result).toBeNull()
    }
  }, 10000)
})
