import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { LOG_FILENAME } from "../constants/plugin-identity"

const logFile = path.join(os.tmpdir(), LOG_FILENAME)

let buffer: string[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

const FLUSH_INTERVAL_MS = 500
const MAX_BUFFER_SIZE = 50

/** Flushes the log buffer to the log file. */
function flush(): void {
  if (buffer.length === 0) return
  const data = buffer.join("")
  buffer = []
  try {
    fs.appendFileSync(logFile, data)
  } catch {}
}

/** Schedules a flush of the log buffer after a delay. */
function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, FLUSH_INTERVAL_MS)
}

/** Logs a message with an optional data object. */
export function log(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ""}\n`
    buffer.push(logEntry)
    if (buffer.length >= MAX_BUFFER_SIZE) {
      flush()
    } else {
      scheduleFlush()
    }
  } catch {}
}

/** Returns the path to the log file. */
export function getLogFilePath(): string {
  return logFile
}
