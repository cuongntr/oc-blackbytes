import { describe, expect, it } from "bun:test"
import { cliSemaphore, Semaphore } from "../../src/extensions/tools/shared/semaphore"

describe("Semaphore", () => {
  it("allows acquisition up to maxConcurrency without blocking", async () => {
    const sem = new Semaphore(3)
    // All three should resolve immediately
    await sem.acquire()
    await sem.acquire()
    await sem.acquire()
    // current == 3, releasing brings back to 2
    sem.release()
    expect(true).toBe(true) // reached here without hanging
  })

  it("blocks when at capacity, unblocks after release", async () => {
    const sem = new Semaphore(1)
    await sem.acquire() // slot taken

    let secondResolved = false
    const second = sem.acquire().then(() => {
      secondResolved = true
    })

    // Second acquire should be pending
    await Promise.resolve() // microtask flush
    expect(secondResolved).toBe(false)

    sem.release() // should unblock second
    await second
    expect(secondResolved).toBe(true)

    sem.release() // clean up
  })

  it("processes queued waiters in FIFO order", async () => {
    const sem = new Semaphore(1)
    await sem.acquire() // fill the slot

    const order: number[] = []
    const p1 = sem.acquire().then(() => {
      order.push(1)
      sem.release()
    })
    const p2 = sem.acquire().then(() => {
      order.push(2)
      sem.release()
    })
    const p3 = sem.acquire().then(() => {
      order.push(3)
      sem.release()
    })

    sem.release() // trigger chain
    await Promise.all([p1, p2, p3])

    expect(order).toEqual([1, 2, 3])
  })

  it("handles concurrent tasks up to limit correctly", async () => {
    const sem = new Semaphore(2)
    let running = 0
    let maxRunning = 0

    const task = async () => {
      await sem.acquire()
      running++
      maxRunning = Math.max(maxRunning, running)
      // Simulate work via microtask yield
      await Promise.resolve()
      running--
      sem.release()
    }

    await Promise.all([task(), task(), task(), task(), task()])
    expect(maxRunning).toBeLessThanOrEqual(2)
  })

  it("error inside task does not deadlock if caller releases manually", async () => {
    const sem = new Semaphore(1)
    await sem.acquire()

    let caught: unknown
    try {
      throw new Error("task error")
    } catch (e) {
      caught = e
      sem.release()
    }

    expect((caught as Error).message).toBe("task error")

    // Should be acquirable again
    await sem.acquire()
    sem.release()
  })

  it("release processes next waiter from queue", async () => {
    const sem = new Semaphore(1)
    await sem.acquire()

    let resolved = false
    const waiter = sem.acquire().then(() => {
      resolved = true
    })

    expect(resolved).toBe(false)
    sem.release()
    await waiter
    expect(resolved).toBe(true)
    sem.release()
  })
})

describe("cliSemaphore", () => {
  it("is a Semaphore instance with maxConcurrency 4", () => {
    expect(cliSemaphore).toBeInstanceOf(Semaphore)
    // Verify by acquiring 4 slots (they should all resolve immediately)
    const promises = [
      cliSemaphore.acquire(),
      cliSemaphore.acquire(),
      cliSemaphore.acquire(),
      cliSemaphore.acquire(),
    ]
    return Promise.all(promises).then(() => {
      // Release all 4
      cliSemaphore.release()
      cliSemaphore.release()
      cliSemaphore.release()
      cliSemaphore.release()
    })
  })
})
