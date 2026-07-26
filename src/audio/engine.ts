/**
 * Web-Audio synth sound engine for the blackjack trainer.
 *
 * No audio asset files. Every cue is synthesized at runtime from oscillators,
 * filtered noise buffers and gain envelopes, so the app works fully offline.
 *
 * The engine lazily creates and resumes a single shared AudioContext on the
 * first user gesture (respecting the browser autoplay policy), routes everything
 * through a master GainNode, and exposes `play(name)` plus `warmUp()`/`unlock()`.
 */

export type SoundName =
  | 'deal'
  | 'flip'
  | 'chip'
  | 'chipStack'
  | 'shuffle'
  | 'win'
  | 'blackjack'
  | 'push'
  | 'lose'
  | 'bust'
  | 'correct'
  | 'incorrect'
  | 'click'
  | 'deal-check'

// Permissive shape so we can reference the constructor without lib DOM types
// leaking through, and fall back to the webkit-prefixed vendor context.
type AudioCtor = { new (): AudioContext }

function getAudioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    AudioContext?: AudioCtor
    webkitAudioContext?: AudioCtor
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let masterVolume = 0.7
/** A cached, reusable white-noise buffer (built once per context). */
let noiseBuffer: AudioBuffer | null = null

/** True when a usable AudioContext exists in this environment. */
export function isSupported(): boolean {
  return getAudioCtor() !== null
}

/**
 * Lazily create the shared AudioContext + master gain. Returns null when the
 * environment has no Web Audio (e.g. jsdom) or construction throws.
 */
function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = getAudioCtor()
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = masterVolume
    master.connect(ctx.destination)
    noiseBuffer = null
    return ctx
  } catch {
    ctx = null
    master = null
    return null
  }
}

function ensureNoise(context: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer
  const len = Math.floor(context.sampleRate * 1.0)
  const buf = context.createBuffer(1, len, context.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buf
  return buf
}

/** Set the master volume (0..1). Applied immediately if the context exists. */
export function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v))
  if (master && ctx) {
    try {
      master.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.01)
    } catch {
      master.gain.value = masterVolume
    }
  }
}

export function getMasterVolume(): number {
  return masterVolume
}

/**
 * Resume the AudioContext. Browsers require this to happen inside a user
 * gesture. Call it from a pointer/key handler. Safe to call repeatedly.
 */
export function unlock(): void {
  const context = ensureContext()
  if (!context) return
  if (context.state === 'suspended') {
    void context.resume().catch(() => {})
  }
}

/**
 * Prime the audio graph so the first real cue has no allocation hitch.
 * Creates the context (if allowed) and plays a single silent tick.
 */
export function warmUp(): void {
  const context = ensureContext()
  if (!context) return
  unlock()
  try {
    const g = context.createGain()
    g.gain.value = 0
    const osc = context.createOscillator()
    osc.connect(g)
    g.connect(context.destination)
    const t = context.currentTime
    osc.start(t)
    osc.stop(t + 0.01)
  } catch {
    // ignore: warm-up is best-effort
  }
}

// ---- Synth voice helpers ----------------------------------------------------

interface ToneOpts {
  type?: OscillatorType
  freq: number
  /** End frequency for a glide. Defaults to `freq`. */
  toFreq?: number
  start: number
  dur: number
  gain?: number
  attack?: number
  release?: number
}

function tone(context: AudioContext, out: GainNode, o: ToneOpts): void {
  const osc = context.createOscillator()
  const g = context.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, o.start)
  if (o.toFreq && o.toFreq !== o.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.toFreq), o.start + o.dur)
  }
  const peak = o.gain ?? 0.3
  const attack = o.attack ?? 0.005
  const release = o.release ?? Math.max(0.02, o.dur * 0.5)
  g.gain.setValueAtTime(0.0001, o.start)
  g.gain.exponentialRampToValueAtTime(peak, o.start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur + release)
  osc.connect(g)
  g.connect(out)
  osc.start(o.start)
  osc.stop(o.start + o.dur + release + 0.02)
}

interface NoiseOpts {
  start: number
  dur: number
  gain?: number
  filter?: BiquadFilterType
  freq?: number
  q?: number
  /** End frequency for a filter sweep. */
  toFreq?: number
  attack?: number
}

function noise(context: AudioContext, out: GainNode, o: NoiseOpts): void {
  const src = context.createBufferSource()
  src.buffer = ensureNoise(context)
  const g = context.createGain()
  const peak = o.gain ?? 0.2
  const attack = o.attack ?? 0.005
  g.gain.setValueAtTime(0.0001, o.start)
  g.gain.exponentialRampToValueAtTime(peak, o.start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur)
  if (o.filter) {
    const biquad = context.createBiquadFilter()
    biquad.type = o.filter
    biquad.frequency.setValueAtTime(o.freq ?? 1000, o.start)
    if (o.toFreq && o.toFreq !== (o.freq ?? 1000)) {
      biquad.frequency.linearRampToValueAtTime(o.toFreq, o.start + o.dur)
    }
    if (o.q != null) biquad.Q.value = o.q
    src.connect(biquad)
    biquad.connect(g)
  } else {
    src.connect(g)
  }
  g.connect(out)
  src.start(o.start)
  src.stop(o.start + o.dur + 0.02)
}

// ---- Cue definitions --------------------------------------------------------

// Equal-temperament note frequencies for arpeggios/fanfares.
const N = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
}

type CueFn = (context: AudioContext, out: GainNode, t: number) => void

const CUES: Record<SoundName, CueFn> = {
  // Card slide across felt: short filtered-noise swish.
  deal: (c, out, t) => {
    noise(c, out, {
      start: t,
      dur: 0.12,
      gain: 0.18,
      filter: 'bandpass',
      freq: 1800,
      toFreq: 700,
      q: 0.8,
    })
  },
  // Card turn: slightly brighter, faster swish + soft tick.
  flip: (c, out, t) => {
    noise(c, out, {
      start: t,
      dur: 0.09,
      gain: 0.16,
      filter: 'bandpass',
      freq: 2600,
      toFreq: 1200,
      q: 1,
    })
    tone(c, out, { type: 'triangle', freq: 520, start: t + 0.04, dur: 0.03, gain: 0.08 })
  },
  // Single chip clink: bright metallic ping.
  chip: (c, out, t) => {
    tone(c, out, { type: 'triangle', freq: 2400, start: t, dur: 0.04, gain: 0.16 })
    tone(c, out, { type: 'sine', freq: 3200, start: t, dur: 0.03, gain: 0.1 })
    noise(c, out, { start: t, dur: 0.03, gain: 0.06, filter: 'highpass', freq: 3000 })
  },
  // Stack of chips: layered clinks staggered in time.
  chipStack: (c, out, t) => {
    for (let i = 0; i < 4; i++) {
      const st = t + i * 0.045
      tone(c, out, {
        type: 'triangle',
        freq: 2200 + i * 180,
        start: st,
        dur: 0.04,
        gain: 0.12,
      })
      noise(c, out, { start: st, dur: 0.025, gain: 0.05, filter: 'highpass', freq: 3200 })
    }
  },
  // Shuffle: wash of sweeping filtered noise.
  shuffle: (c, out, t) => {
    noise(c, out, {
      start: t,
      dur: 0.5,
      gain: 0.14,
      filter: 'bandpass',
      freq: 900,
      toFreq: 2400,
      q: 0.6,
      attack: 0.08,
    })
    noise(c, out, {
      start: t + 0.12,
      dur: 0.35,
      gain: 0.1,
      filter: 'bandpass',
      freq: 1600,
      toFreq: 800,
      q: 0.6,
      attack: 0.06,
    })
  },
  // Win: rising major arpeggio.
  win: (c, out, t) => {
    const notes = [N.C4, N.E4, N.G4, N.C5]
    notes.forEach((f, i) =>
      tone(c, out, { type: 'triangle', freq: f, start: t + i * 0.08, dur: 0.12, gain: 0.2 }),
    )
  },
  // Blackjack: brighter, longer fanfare with an octave sparkle.
  blackjack: (c, out, t) => {
    const notes = [N.C5, N.E5, N.G5, N.C6]
    notes.forEach((f, i) =>
      tone(c, out, { type: 'triangle', freq: f, start: t + i * 0.07, dur: 0.16, gain: 0.22 }),
    )
    tone(c, out, { type: 'sine', freq: N.C6, start: t + 0.28, dur: 0.3, gain: 0.14 })
    tone(c, out, { type: 'sine', freq: N.G5, start: t + 0.28, dur: 0.3, gain: 0.1 })
  },
  // Push: neutral single tick.
  push: (c, out, t) => {
    tone(c, out, { type: 'sine', freq: 440, start: t, dur: 0.09, gain: 0.16 })
  },
  // Lose: low descending thud.
  lose: (c, out, t) => {
    tone(c, out, {
      type: 'sine',
      freq: 220,
      toFreq: 110,
      start: t,
      dur: 0.28,
      gain: 0.24,
      release: 0.12,
    })
  },
  // Bust: deeper, harsher descending thud.
  bust: (c, out, t) => {
    tone(c, out, {
      type: 'sawtooth',
      freq: 180,
      toFreq: 70,
      start: t,
      dur: 0.34,
      gain: 0.22,
      release: 0.14,
    })
    tone(c, out, { type: 'sine', freq: 90, toFreq: 55, start: t, dur: 0.3, gain: 0.18 })
  },
  // Correct: up two-note chirp.
  correct: (c, out, t) => {
    tone(c, out, { type: 'sine', freq: N.G4, start: t, dur: 0.08, gain: 0.18 })
    tone(c, out, { type: 'sine', freq: N.C5, start: t + 0.09, dur: 0.1, gain: 0.18 })
  },
  // Incorrect: down two-note.
  incorrect: (c, out, t) => {
    tone(c, out, { type: 'sine', freq: N.E4, start: t, dur: 0.09, gain: 0.16 })
    tone(c, out, { type: 'sine', freq: 233.08, start: t + 0.1, dur: 0.13, gain: 0.16 })
  },
  // Click: soft UI tick.
  click: (c, out, t) => {
    tone(c, out, { type: 'sine', freq: 900, start: t, dur: 0.02, gain: 0.1, release: 0.02 })
  },
  // Deal-check (peek): subtle low tick.
  'deal-check': (c, out, t) => {
    tone(c, out, { type: 'sine', freq: 320, start: t, dur: 0.05, gain: 0.08 })
  },
}

/** The set of valid cue names, exported for consumers/tests. */
export const SOUND_NAMES = Object.keys(CUES) as SoundName[]

/**
 * Play a named cue. No-ops silently when Web Audio is unavailable (jsdom),
 * the context can't be created, or the name is unknown. `gainScale` (0..1)
 * lets callers apply per-play attenuation on top of the master volume.
 */
export function play(name: SoundName, gainScale = 1): void {
  const cue = CUES[name]
  if (!cue) return
  const context = ensureContext()
  if (!context || !master) return
  // Resume if a gesture already unlocked us but the context drifted to suspended.
  if (context.state === 'suspended') void context.resume().catch(() => {})

  let out = master
  const scale = Math.max(0, Math.min(1, gainScale))
  if (scale !== 1) {
    try {
      const g = context.createGain()
      g.gain.value = scale
      g.connect(master)
      out = g
    } catch {
      out = master
    }
  }

  try {
    cue(context, out, context.currentTime + 0.001)
  } catch {
    // Never let a synthesis failure bubble into the UI.
  }
}

/** Tear down the context (used by tests to reset between cases). */
export function _reset(): void {
  if (ctx) {
    try {
      void ctx.close()
    } catch {
      // ignore
    }
  }
  ctx = null
  master = null
  noiseBuffer = null
}
