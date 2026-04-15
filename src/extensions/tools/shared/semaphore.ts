/**
 * Simple counting semaphore to limit concurrent subprocess invocations.
 */
export class Semaphore {
  private current = 0
  private queue: Array<() => void> = []

  constructor(private readonly maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.maxConcurrency) {
      this.current++
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++
        resolve()
      })
    })
  }

  release(): void {
    this.current--
    const next = this.queue.shift()
    if (next) next()
  }
}

/** Shared semaphore for ripgrep/ast-grep subprocess concurrency (max 4). */
export const cliSemaphore = new Semaphore(4)
