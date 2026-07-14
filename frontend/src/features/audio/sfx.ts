import { useSettingsStore } from '../../state/settingsStore'

/**
 * 8-Bit-Soundeffekte (Phase C1): Chiptune-Bleeps direkt per Oszillator —
 * keine Audio-Assets, kein Netzwerk. Jeder Effekt ist eine kleine
 * Noten-Sequenz auf Rechteck-/Sägezahnwellen mit knackiger Hüllkurve.
 *
 * Der AudioContext entsteht lazy beim ersten Klang nach einer User-Geste
 * (Autoplay-Policy); ist er noch gesperrt, verpufft der Effekt lautlos.
 */

let ctx: AudioContext | null = null

function audioCtx(): AudioContext | null {
  if (useSettingsStore.getState().muted) return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface Note {
  freq: number
  /** Startzeit in Sekunden relativ zum Aufruf. */
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
}

function play(notes: Note[]): void {
  const ac = audioCtx()
  if (!ac) return
  const t0 = ac.currentTime
  for (const n of notes) {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = n.type ?? 'square'
    osc.frequency.value = n.freq
    const start = t0 + n.at
    const end = start + n.dur
    const peak = n.gain ?? 0.07
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(g)
    g.connect(ac.destination)
    osc.start(start)
    osc.stop(end + 0.02)
  }
}

export const sfx = {
  /** Richtige Antwort: zwei Blips aufwärts. */
  correct(): void {
    play([
      { freq: 660, at: 0, dur: 0.07 },
      { freq: 880, at: 0.08, dur: 0.09 },
    ])
  },

  /** Falsch/verpeilt: Sägezahn abwärts. */
  wrong(): void {
    play([
      { freq: 220, at: 0, dur: 0.12, type: 'sawtooth' },
      { freq: 150, at: 0.12, dur: 0.18, type: 'sawtooth' },
    ])
  },

  /** VOLLTREFFER! (Pin ≤ 100 km): C-Dur-Arpeggio. */
  volltreffer(): void {
    play(
      [523, 659, 784, 1047].map((freq, i) => ({
        freq,
        at: i * 0.07,
        dur: 0.09,
      })),
    )
  },

  /** +5 SEC! — Münz-Jingle, leicht verzögert hinter dem Antwort-Sound. */
  reclaim(): void {
    play([
      { freq: 988, at: 0.3, dur: 0.08 },
      { freq: 1319, at: 0.39, dur: 0.22 },
    ])
  },

  /** Countdown-Tick (3, 2, 1). */
  tick(): void {
    play([{ freq: 440, at: 0, dur: 0.06 }])
  },

  /** GO! */
  go(): void {
    play([{ freq: 880, at: 0, dur: 0.18 }])
  },

  /** LEVEL UP! (Phase G): aufsteigendes Doppel-Arpeggio mit Schluss-Glanz. */
  levelup(): void {
    play([
      { freq: 523, at: 0, dur: 0.09 },
      { freq: 659, at: 0.09, dur: 0.09 },
      { freq: 784, at: 0.18, dur: 0.09 },
      { freq: 1047, at: 0.27, dur: 0.12 },
      { freq: 1319, at: 0.4, dur: 0.12 },
      { freq: 1568, at: 0.53, dur: 0.28, gain: 0.09 },
    ])
  },

  /** Runden-/Cup-Ende. */
  fanfare(): void {
    play([
      { freq: 523, at: 0, dur: 0.12 },
      { freq: 659, at: 0.12, dur: 0.12 },
      { freq: 784, at: 0.24, dur: 0.12 },
      { freq: 1047, at: 0.38, dur: 0.3 },
    ])
  },
}
