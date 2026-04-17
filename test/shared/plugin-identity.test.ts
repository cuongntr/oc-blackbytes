import { describe, expect, it } from "bun:test"
import {
  CACHE_DIR_NAME,
  CONFIG_BASENAME,
  LOG_FILENAME,
  PLUGIN_NAME,
} from "../../src/shared/constants/plugin-identity"

describe("plugin-identity constants", () => {
  it("PLUGIN_NAME equals 'oc-blackbytes'", () => {
    expect(PLUGIN_NAME).toBe("oc-blackbytes")
  })

  it("CONFIG_BASENAME equals 'oc-blackbytes'", () => {
    expect(CONFIG_BASENAME).toBe("oc-blackbytes")
  })

  it("LOG_FILENAME equals 'oc-blackbytes.log'", () => {
    expect(LOG_FILENAME).toBe("oc-blackbytes.log")
  })

  it("CACHE_DIR_NAME equals 'oc-blackbytes'", () => {
    expect(CACHE_DIR_NAME).toBe("oc-blackbytes")
  })
})
