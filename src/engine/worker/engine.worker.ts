/// <reference lib="webworker" />
import { handleEngineRequest, type EngineRequest } from './client'

// Module worker: receive a typed request, run the pure engine dispatcher, and
// post the typed response straight back. All heavy math (EV solve, dealer
// enumeration, Monte-Carlo) runs here so the UI thread never blocks.
const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (e: MessageEvent<EngineRequest>) => {
  ctx.postMessage(handleEngineRequest(e.data))
}
