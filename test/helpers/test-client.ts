/**
 * TestClient is NOT a mock. It is a real test double: a concrete class implementing
 * the minimum surface of the OpenCode plugin client contract used by BlackbytesPlugin.
 * All methods are real methods that return deterministic canned data and record calls
 * to an internal array for inspection.
 */
export interface TestClientCall {
  method: string
  args: unknown[]
}

export class TestClient {
  readonly calls: TestClientCall[] = []

  private record(method: string, args: unknown[]): void {
    this.calls.push({ method, args })
  }

  // Add real stub methods here as BlackbytesPlugin references more off ctx.client.
  // Currently BlackbytesPlugin passes ctx.client to loadPluginConfig which handles
  // both string and object cases — a plain string "opencode" is sufficient for most paths.
  // This class exists for future expansion when object-typed clients are needed.

  toString(): string {
    this.record("toString", [])
    return "opencode"
  }
}
