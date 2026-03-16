const CLOSED = Symbol("CLOSED")

export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: (T | typeof CLOSED)[] = []
  private resolvers: ((value: T | typeof CLOSED) => void)[] = []
  private closed = false

  push(item: T) {
    if (this.closed) return
    const resolve = this.resolvers.shift()
    if (resolve) resolve(item)
    else this.queue.push(item)
  }

  close() {
    if (this.closed) return
    this.closed = true
    const resolve = this.resolvers.shift()
    if (resolve) resolve(CLOSED)
    else this.queue.push(CLOSED)
  }

  async next(): Promise<T | undefined> {
    if (this.queue.length > 0) {
      const item = this.queue.shift()!
      if (item === CLOSED) return undefined
      return item
    }
    if (this.closed) return undefined
    const item = await new Promise<T | typeof CLOSED>((resolve) => this.resolvers.push(resolve))
    if (item === CLOSED) return undefined
    return item
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      const item = await this.next()
      if (item === undefined) return
      yield item
    }
  }
}

export async function work<T>(concurrency: number, items: T[], fn: (item: T) => Promise<void>) {
  const pending = [...items]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (pending.length > 0) {
        const item = pending.shift()!
        await fn(item)
      }
    }),
  )
}
