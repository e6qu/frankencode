import { Log } from "./log"

declare global {
  namespace NodeJS {
    interface Process {
      _getActiveHandles(): object[]
      _getActiveRequests(): object[]
    }
  }
}

export namespace EventLoop {
  export async function wait() {
    return new Promise<void>((resolve) => {
      const check = () => {
        const active = [...process._getActiveHandles(), ...process._getActiveRequests()]
        Log.Default.info("eventloop", {
          active,
        })
        if (process._getActiveHandles().length === 0 && process._getActiveRequests().length === 0) {
          resolve()
        } else {
          setImmediate(check)
        }
      }
      check()
    })
  }
}
