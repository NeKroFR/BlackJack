import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  play,
  warmUp,
  unlock,
  setMasterVolume,
  getMasterVolume,
  isSupported,
  SOUND_NAMES,
  _reset,
  type SoundName,
} from './engine'

// jsdom provides no AudioContext, so these exercise the "absent AudioContext"
// path — every export must be safe (no throw, no-op) with no audio backend.

afterEach(() => {
  _reset()
  vi.unstubAllGlobals()
})

describe('engine with absent AudioContext (jsdom)', () => {
  it('reports unsupported when no AudioContext exists', () => {
    expect(isSupported()).toBe(false)
  })

  it('loads and exposes every named cue', () => {
    expect(SOUND_NAMES.length).toBeGreaterThan(0)
    expect(SOUND_NAMES).toContain('deal')
    expect(SOUND_NAMES).toContain('blackjack')
  })

  it('play() is a safe no-op for every cue', () => {
    for (const name of SOUND_NAMES) {
      expect(() => play(name)).not.toThrow()
    }
  })

  it('play() ignores unknown names without throwing', () => {
    expect(() => play('nope' as SoundName)).not.toThrow()
  })

  it('warmUp() and unlock() are safe no-ops', () => {
    expect(() => warmUp()).not.toThrow()
    expect(() => unlock()).not.toThrow()
  })

  it('volume setter clamps and is safe without a context', () => {
    setMasterVolume(2)
    expect(getMasterVolume()).toBe(1)
    setMasterVolume(-1)
    expect(getMasterVolume()).toBe(0)
    setMasterVolume(0.5)
    expect(getMasterVolume()).toBe(0.5)
  })
})

describe('engine with a mocked AudioContext', () => {
  function makeMockContext() {
    const started: string[] = []
    const makeParam = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    })
    const gain = () => ({ gain: makeParam(), connect: vi.fn() })
    const ctx = {
      state: 'running' as string,
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      resume: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
      createGain: vi.fn(gain),
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: makeParam(),
        connect: vi.fn(),
        start: vi.fn(() => started.push('osc')),
        stop: vi.fn(),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'lowpass',
        frequency: makeParam(),
        Q: { value: 0 },
        connect: vi.fn(),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(() => started.push('buf')),
        stop: vi.fn(),
      })),
      createBuffer: vi.fn((_ch: number, len: number) => ({
        getChannelData: () => new Float32Array(len),
      })),
    }
    return { ctx, started }
  }

  it('creates voices for every cue when a context is present', () => {
    const { ctx, started } = makeMockContext()
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ctx),
    )
    for (const name of SOUND_NAMES) {
      expect(() => play(name)).not.toThrow()
    }
    expect(started.length).toBeGreaterThan(0)
    expect(ctx.createGain).toHaveBeenCalled()
  })

  it('resumes a suspended context on unlock', () => {
    const { ctx } = makeMockContext()
    ctx.state = 'suspended'
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ctx),
    )
    unlock()
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('never throws if the context constructor itself throws', () => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => {
        throw new Error('boom')
      }),
    )
    expect(() => play('deal')).not.toThrow()
    expect(() => warmUp()).not.toThrow()
  })
})
