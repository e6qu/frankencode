export function signal() {
  let resolve: (value?: void) => void
  const promise = new Promise<void>((r) => (resolve = r))
  return {
    trigger() {
      return resolve()
    },
    wait() {
      return promise
    },
  }
}
