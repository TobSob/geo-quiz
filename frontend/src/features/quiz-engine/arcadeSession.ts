import type { DataBundle, Rng } from './questionGenerator'
import { defaultRng, generateQuestion } from './questionGenerator'
import type { GameMode, Question } from './types'
import type { PinTier } from './arcadeScoring'
import {
  nextStreakChoice,
  nextStreakPin,
  pinTierFor,
  reclaimedSeconds,
  scoreChoiceArcade,
  scorePinArcade,
  PIN_CORRECT_MAX_KM,
  MIN_QUESTION_MS,
} from './arcadeScoring'

/**
 * Arcade-Session-Engine (Phase E2, Regelwerk: DESIGN-ARCADE.md).
 *
 * Framework-frei und mit injizierbarer Uhr — der React-Hook (E3) wrappt sie
 * nur, und in Phase D läuft derselbe Code serverseitig in der Edge Function.
 *
 * Zeitmodell (Pausen-Regeln aus DESIGN-ARCADE):
 * - Ein Zeitbudget (60 s bzw. 30 s im Cup) wird NUR verbraucht, solange eine
 *   Frage aktiv ist. Feedback-Phasen sind budgetneutral — dort ist nichts von
 *   der nächsten Frage sichtbar, also gibt es nichts zu erschummeln.
 * - Innerhalb einer aktiven Frage zählt die Wanduhr (`now()`-Differenzen):
 *   App im Hintergrund, eingefrorener Tab oder DevTools halten sie nicht an.
 *   Kommt eine Antwort erst nach Budget-Ende an, ist sie ungültig und die
 *   Session vorbei.
 * - Streak-Rückholungen (+5 s je vollem Zehner) verlängern das Budget.
 */

export type ArcadePhase = 'idle' | 'question' | 'feedback' | 'done'

export interface ArcadeAnswerFeedback {
  questionId: string
  /** Choice: getroffen. Pin: Stufe STARK! oder besser (≤ 350 km) — Basis fürs Lern-Tracking. */
  correct: boolean
  points: number
  streakBefore: number
  streakAfter: number
  /** Zurückgeholte Sekunden: Zehner-Übergang (+5 s) plus Volltreffer-Bonus (+3 s). */
  reclaimedSeconds: number
  /** Nur bei Pin-Antworten gesetzt. */
  tier: PinTier | null
  distanceKm?: number
}

export interface ArcadeSummary {
  mode: GameMode
  score: number
  questionCount: number
  correctCount: number
  bestStreak: number
  /** Verbrauchte aktive Spielzeit in ms (Feedback-Pausen zählen nicht). */
  playedMs: number
  /** Über Streak-Rückholungen dazugewonnene Sekunden. */
  timeAddedSeconds: number
  answers: ArcadeAnswerFeedback[]
}

export interface ArcadeSessionConfig {
  mode: GameMode
  /** Startbudget in ms (SESSION_SECONDS bzw. CUP_LEG_SECONDS × 1000). */
  budgetMs: number
  /**
   * Liefert die nächste Frage; darf keine ID aus `usedIds` wiederholen.
   * `null` = Pool erschöpft → Session endet vorzeitig.
   */
  nextQuestion: (usedIds: ReadonlySet<string>) => Question | null
  now?: () => number
}

export class ArcadeSession {
  private readonly cfg: ArcadeSessionConfig
  private readonly now: () => number
  private readonly usedIds = new Set<string>()

  private phaseValue: ArcadePhase = 'idle'
  private current: Question | null = null
  /** Vorab gezogene nächste Frage (fürs unsichtbare Preload in der Pause). */
  private staged: Question | null = null
  private budgetMs: number
  /** Budget, das durch abgeschlossene Fragen bereits verbraucht ist. */
  private consumedMs = 0
  private questionShownAt = 0
  private scoreValue = 0
  private streakValue = 0
  private bestStreakValue = 0
  private timeAddedMs = 0
  private readonly answersList: ArcadeAnswerFeedback[] = []

  constructor(cfg: ArcadeSessionConfig) {
    this.cfg = cfg
    this.budgetMs = cfg.budgetMs
    this.now = cfg.now ?? (() => Date.now())
  }

  get phase(): ArcadePhase {
    return this.phaseValue
  }

  get question(): Question | null {
    return this.current
  }

  get score(): number {
    return this.scoreValue
  }

  get streak(): number {
    return this.streakValue
  }

  get bestStreak(): number {
    return this.bestStreakValue
  }

  get answers(): readonly ArcadeAnswerFeedback[] {
    return this.answersList
  }

  /** Restbudget in ms — tickt nur während einer aktiven Frage herunter. */
  remainingMs(): number {
    const activeMs =
      this.phaseValue === 'question' ? this.now() - this.questionShownAt : 0
    return Math.max(0, this.budgetMs - this.consumedMs - activeMs)
  }

  /**
   * Nächste Frage vorziehen, OHNE die Uhr zu starten — fürs unsichtbare
   * Preload (Landmark-Foto) während Idle/Feedback (Pausen-Regel 1). Die UI
   * darf den Inhalt erst zeigen, wenn `start()`/`next()` ihn aufgedeckt hat.
   * Idempotent; `null` = Pool erschöpft.
   */
  prepareNext(): Question | null {
    if (this.phaseValue !== 'idle' && this.phaseValue !== 'feedback') return null
    if (this.staged) return this.staged
    const q = this.cfg.nextQuestion(this.usedIds)
    if (q) {
      this.usedIds.add(q.id)
      this.staged = q
    }
    return q
  }

  /** Erste Frage aufdecken — Uhr startet mit dem Aufdecken (atomar). */
  start(): void {
    if (this.phaseValue !== 'idle') return
    this.presentNext()
  }

  /**
   * Antwort auf eine Choice-Frage. `null` = bewusst keine Auswahl (zählt als
   * falsch). Rückgabe `null`, wenn die Antwort ungültig war (falsche Phase
   * oder nach Budget-Ende eingetroffen → Session ist dann `done`).
   */
  answerChoice(chosenIndex: number | null): ArcadeAnswerFeedback | null {
    if (this.phaseValue !== 'question' || this.current?.kind !== 'choice') {
      return null
    }
    if (this.closeQuestionOrEnd()) return null
    const correct = chosenIndex === this.current.correctIndex
    const streakBefore = this.streakValue
    const points = scoreChoiceArcade(correct, streakBefore)
    const streakAfter = nextStreakChoice(streakBefore, correct)
    return this.applyAnswer({
      questionId: this.current.id,
      correct,
      points,
      streakBefore,
      streakAfter,
      reclaimedSeconds: reclaimedSeconds(streakBefore, streakAfter),
      tier: null,
    })
  }

  /**
   * Antwort auf eine Pin-Frage mit bereits berechneter Distanz (die UI kennt
   * die Geometrie). `null` = kein Pin gesetzt → wie VÖLLIG VERPEILT.
   */
  answerPin(distanceKm: number | null): ArcadeAnswerFeedback | null {
    if (this.phaseValue !== 'question' || this.current?.kind !== 'pin') {
      return null
    }
    if (this.closeQuestionOrEnd()) return null
    const streakBefore = this.streakValue
    if (distanceKm === null) {
      return this.applyAnswer({
        questionId: this.current.id,
        correct: false,
        points: 0,
        streakBefore,
        streakAfter: 0,
        reclaimedSeconds: 0,
        tier: pinTierFor(Infinity),
      })
    }
    const tier = pinTierFor(distanceKm)
    const points = scorePinArcade(distanceKm, streakBefore)
    const streakAfter = nextStreakPin(streakBefore, distanceKm)
    return this.applyAnswer({
      questionId: this.current.id,
      correct: distanceKm <= PIN_CORRECT_MAX_KM,
      points,
      streakBefore,
      streakAfter,
      // Zehner-Rückholung plus Volltreffer-Zeitbonus dieser Stufe.
      reclaimedSeconds:
        reclaimedSeconds(streakBefore, streakAfter) + tier.timeBonusSeconds,
      tier,
      distanceKm,
    })
  }

  /** Feedback quittiert → nächste Frage aufdecken oder Session beenden. */
  next(): void {
    if (this.phaseValue !== 'feedback') return
    if (this.budgetMs - this.consumedMs <= 0) {
      this.finish()
      return
    }
    this.presentNext()
  }

  /** Von der UI gerufen, wenn ihre Anzeige 0 erreicht (Frage bleibt unbewertet). */
  forceTimeUp(): void {
    if (this.phaseValue !== 'question') return
    if (this.remainingMs() > 0) return
    this.consumedMs = this.budgetMs
    this.finish()
  }

  summary(): ArcadeSummary {
    return {
      mode: this.cfg.mode,
      score: this.scoreValue,
      questionCount: this.answersList.length,
      correctCount: this.answersList.filter((a) => a.correct).length,
      bestStreak: this.bestStreakValue,
      playedMs: Math.min(this.consumedMs, this.budgetMs),
      timeAddedSeconds: this.timeAddedMs / 1000,
      answers: [...this.answersList],
    }
  }

  /**
   * Bucht die aktive Fragezeit aufs Budget. True = Budget war schon
   * aufgebraucht (Antwort kam zu spät, Wanduhr!) und die Session ist beendet.
   */
  private closeQuestionOrEnd(): boolean {
    // Jede Frage kostet mindestens MIN_QUESTION_MS Budget — so verliert auch
    // Tasten-Spam Zeit, ohne dass es sich wie eine Strafe anfühlt (R3).
    const elapsed = Math.max(this.now() - this.questionShownAt, MIN_QUESTION_MS)
    this.consumedMs += elapsed
    if (this.consumedMs >= this.budgetMs) {
      this.consumedMs = this.budgetMs
      this.finish()
      return true
    }
    return false
  }

  private applyAnswer(fb: ArcadeAnswerFeedback): ArcadeAnswerFeedback {
    this.scoreValue += fb.points
    this.streakValue = fb.streakAfter
    this.bestStreakValue = Math.max(this.bestStreakValue, fb.streakAfter)
    if (fb.reclaimedSeconds > 0) {
      this.budgetMs += fb.reclaimedSeconds * 1000
      this.timeAddedMs += fb.reclaimedSeconds * 1000
    }
    this.answersList.push(fb)
    this.phaseValue = 'feedback'
    return fb
  }

  private presentNext(): void {
    const q = this.staged ?? this.cfg.nextQuestion(this.usedIds)
    this.staged = null
    if (!q) {
      this.finish()
      return
    }
    this.usedIds.add(q.id)
    this.current = q
    this.questionShownAt = this.now()
    this.phaseValue = 'question'
  }

  private finish(): void {
    this.current = null
    this.phaseValue = 'done'
  }
}

/**
 * Standard-Fragenquelle: generiert Fragen für einen Modus und filtert
 * Session-Wiederholungen (No-Repeat-Auflage aus DESIGN-ARCADE O6) heraus.
 * Nach `maxTries` Kollisionen gilt der Pool als erschöpft.
 */
export function makeGeneratorSource(
  mode: GameMode,
  data: DataBundle,
  rng: Rng = defaultRng,
  maxTries = 100,
): (usedIds: ReadonlySet<string>) => Question | null {
  return (usedIds) => {
    for (let i = 0; i < maxTries; i++) {
      const q = generateQuestion(mode, data, rng)
      if (!usedIds.has(q.id)) return q
    }
    return null
  }
}
