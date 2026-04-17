type EnvOverrides = Record<string, string | undefined>

export async function withEnv<T>(overrides: EnvOverrides, fn: () => T | Promise<T>): Promise<T> {
  const snapshot: EnvOverrides = {}

  for (const key of Object.keys(overrides)) {
    snapshot[key] = process.env[key]
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    return await fn()
  } finally {
    for (const [key, original] of Object.entries(snapshot)) {
      if (original === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = original
      }
    }
  }
}

export function withOpencodeConfigDir<T>(dir: string, fn: () => T | Promise<T>): Promise<T> {
  return withEnv({ OPENCODE_CONFIG_DIR: dir }, fn)
}
