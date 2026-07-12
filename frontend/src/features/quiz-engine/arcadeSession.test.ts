import { describe, expect, it } from 'vitest'
import { ArcadeSession, makeGeneratorSource } from './arcadeSession'
import type { ChoiceQuestion, City, PinQuestion } from './types'

/** Steuerbare Uhr: Tests rücken die Zeit explizit vor. */
function makeClock(startMs = 0) {
  let t = startMs
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

let idCounter = 0

function choiceQuestion(id?: string): ChoiceQuestion {
  return {
    kind: 'choice',
    id: id ?? `flag:Q${idCounter++}`,
    mode: 'flags',
    prompt: 'Welches Land gehört zu dieser Flagge?',
    promptIso2: 'DE',
    options: ['Deutschland', 'Belgien', 'Österreich', 'Dänemark'],
    correctIndex: 0,
    timeLimitMs: 8000,
  }
}

function pinQuestion(id?: string): PinQuestion {
  return {
    kind: 'pin',
    id: id ?? `city-pin:Q${idCounter++}`,
    mode: 'city-pin',
    prompt: 'Wo liegt Berlin?',
    target: { lat: 52.52, lng: 13.405 },
    targetName: 'Berlin',
    countryIso2: 'DE',
    falloffKm: 200,
    timeLimitMs: 15000,
  }
}

function choiceSession(budgetMs = 60_000) {
  const clock = makeClock()
  const session = new ArcadeSession({
    mode: 'flags',
    budgetMs,
    nextQuestion: () => choiceQuestion(),
    now: clock.now,
  })
  return { clock, session }
}

describe('ArcadeSession — Zeitbudget', () => {
  it('startet mit vollem Budget und tickt nur bei aktiver Frage', () => {
    const { clock, session } = choiceSession()
    session.start()
    expect(session.phase).toBe('question')
    expect(session.remainingMs()).toBe(60_000)

    clock.advance(3000)
    expect(session.remainingMs()).toBe(57_000)

    session.answerChoice(0)
    expect(session.phase).toBe('feedback')

    // Feedback-Pause ist budgetneutral (Pausen-Regel 1)
    clock.advance(10_000)
    expect(session.remainingMs()).toBe(57_000)

    session.next()
    expect(session.phase).toBe('question')
    expect(session.remainingMs()).toBe(57_000)
  })

  it('Wanduhr: eine nach Budget-Ende eintreffende Antwort ist ungültig (Pausen-Regel 2)', () => {
    const { clock, session } = choiceSession()
    session.start()

    // App weggedrückt und 2 Minuten später geantwortet
    clock.advance(120_000)
    const fb = session.answerChoice(0)

    expect(fb).toBeNull()
    expect(session.phase).toBe('done')
    expect(session.score).toBe(0)
    expect(session.summary().questionCount).toBe(0)
  })

  it('forceTimeUp beendet nur bei wirklich leerem Budget', () => {
    const { clock, session } = choiceSession()
    session.start()

    session.forceTimeUp() // Anzeige lügt — Budget ist noch voll
    expect(session.phase).toBe('question')

    clock.advance(60_000)
    session.forceTimeUp()
    expect(session.phase).toBe('done')
  })

  it('next() nach aufgebrauchtem Budget beendet die Session', () => {
    const { clock, session } = choiceSession(10_000)
    session.start()
    clock.advance(10_000)
    session.answerChoice(0)
    // Antwort exakt bei 0 verbleibendem Budget → ungültig, Session vorbei
    expect(session.phase).toBe('done')
  })
})

describe('ArcadeSession — Scoring & Streak', () => {
  it('Multiplikator nutzt die Streak vor der Antwort', () => {
    const { clock, session } = choiceSession()
    session.start()

    const first = session.answerChoice(0)
    expect(first?.points).toBe(100) // Streak 0 → 100 %
    clock.advance(100)
    session.next()

    const second = session.answerChoice(0)
    expect(second?.points).toBe(110) // Streak 1 → 110 %
    expect(session.score).toBe(210)
  })

  it('falsche Antwort: 0 Punkte, Streak weg, bestStreak bleibt', () => {
    const { session } = choiceSession()
    session.start()
    session.answerChoice(0)
    session.next()

    const fb = session.answerChoice(3)
    expect(fb?.points).toBe(0)
    expect(fb?.streakAfter).toBe(0)
    expect(session.bestStreak).toBe(1)
  })

  it('Streak 10 erreicht → +5 Sekunden aufs Budget (O3: automatisch)', () => {
    const { session } = choiceSession()
    session.start()

    let lastReclaim = 0
    for (let i = 0; i < 10; i++) {
      const fb = session.answerChoice(0)
      lastReclaim = fb?.reclaimedSeconds ?? 0
      session.next()
    }

    expect(lastReclaim).toBe(5) // 10. Antwort überschreitet den Zehner
    expect(session.remainingMs()).toBe(65_000) // keine Zeit verbraucht, +5 s
    expect(session.summary().timeAddedSeconds).toBe(5)
  })
})

describe('ArcadeSession — Pin-Antworten', () => {
  function pinSession() {
    const clock = makeClock()
    const session = new ArcadeSession({
      mode: 'city-pin',
      budgetMs: 60_000,
      nextQuestion: () => pinQuestion(),
      now: clock.now,
    })
    session.start()
    return { clock, session }
  }

  it('Stufen: Punkte, Streak-Delta und correct-Grenze (≤ 200 km)', () => {
    const { session } = pinSession()

    const fb1 = session.answerPin(50) // VOLLTREFFER!
    expect(fb1?.tier?.id).toBe('volltreffer')
    expect(fb1?.points).toBe(100)
    expect(fb1?.correct).toBe(true)
    expect(fb1?.streakAfter).toBe(1)
    session.next()

    const fb2 = session.answerPin(180) // STARK!
    expect(fb2?.points).toBe(55) // 50 × 110 %
    expect(fb2?.correct).toBe(true)
    expect(fb2?.streakAfter).toBe(1.5)
    session.next()

    const fb3 = session.answerPin(450) // KNAPP VORBEI
    expect(fb3?.correct).toBe(false)
    expect(fb3?.streakAfter).toBe(1.6)
    session.next()

    const fb4 = session.answerPin(900) // NAJA… hält die Streak
    expect(fb4?.points).toBe(1)
    expect(fb4?.streakAfter).toBe(1.6)
    session.next()

    const fb5 = session.answerPin(5000) // VÖLLIG VERPEILT bricht
    expect(fb5?.points).toBe(0)
    expect(fb5?.streakAfter).toBe(0)
  })

  it('kein Pin gesetzt = VÖLLIG VERPEILT', () => {
    const { session } = pinSession()
    session.answerPin(80)
    session.next()

    const fb = session.answerPin(null)
    expect(fb?.tier?.id).toBe('verpeilt')
    expect(fb?.points).toBe(0)
    expect(fb?.streakAfter).toBe(0)
  })
})

describe('ArcadeSession — Fragen-Nachschub', () => {
  it('wiederholt keine Frage und endet bei erschöpftem Pool', () => {
    const pool = [choiceQuestion('flag:A'), choiceQuestion('flag:B')]
    const clock = makeClock()
    const session = new ArcadeSession({
      mode: 'flags',
      budgetMs: 60_000,
      nextQuestion: (used) => pool.find((q) => !used.has(q.id)) ?? null,
      now: clock.now,
    })

    session.start()
    expect(session.question?.id).toBe('flag:A')
    session.answerChoice(0)
    session.next()
    expect(session.question?.id).toBe('flag:B')
    session.answerChoice(0)
    session.next()

    expect(session.phase).toBe('done')
    expect(session.summary().questionCount).toBe(2)
  })

  it('makeGeneratorSource liefert nur ungenutzte IDs und null bei Erschöpfung', () => {
    const cities: City[] = [
      { id: 'berlin', name: 'Berlin', countryIso2: 'DE', lat: 52.5, lng: 13.4, population: 3_700_000, isCapital: true },
      { id: 'paris', name: 'Paris', countryIso2: 'FR', lat: 48.9, lng: 2.35, population: 2_100_000, isCapital: true },
    ]
    const source = makeGeneratorSource('city-pin', {
      countries: [],
      cities,
      landmarks: [],
    })

    const used = new Set<string>()
    const q1 = source(used)
    expect(q1).not.toBeNull()
    used.add(q1!.id)
    const q2 = source(used)
    expect(q2).not.toBeNull()
    expect(q2!.id).not.toBe(q1!.id)
    used.add(q2!.id)

    expect(source(used)).toBeNull()
  })
})

describe('ArcadeSession — prepareNext (Preload ohne Uhr-Start)', () => {
  it('zieht die Frage vor, next() deckt genau diese auf — ohne Zeitverbrauch', () => {
    const pool = [choiceQuestion('flag:A'), choiceQuestion('flag:B')]
    const clock = makeClock()
    const session = new ArcadeSession({
      mode: 'flags',
      budgetMs: 60_000,
      nextQuestion: (used) => pool.find((q) => !used.has(q.id)) ?? null,
      now: clock.now,
    })

    // Erste Frage schon im Idle vorziehen (Landmark-Foto-Preload beim Start)
    const prepared = session.prepareNext()
    expect(prepared?.id).toBe('flag:A')
    expect(session.phase).toBe('idle')

    clock.advance(5000) // Preload-Zeit kostet kein Budget
    session.start()
    expect(session.question?.id).toBe('flag:A')
    expect(session.remainingMs()).toBe(60_000)

    session.answerChoice(0)
    const staged = session.prepareNext()
    expect(staged?.id).toBe('flag:B')
    expect(session.prepareNext()?.id).toBe('flag:B') // idempotent
    expect(session.question?.id).toBe('flag:A') // Feedback zeigt noch die alte

    session.next()
    expect(session.question?.id).toBe('flag:B')
  })

  it('während einer aktiven Frage ist prepareNext tabu', () => {
    const { session } = choiceSession()
    session.start()
    expect(session.prepareNext()).toBeNull()
    expect(session.phase).toBe('question')
  })

  it('erschöpfter Pool: prepareNext null, next() beendet die Session', () => {
    const pool = [choiceQuestion('flag:A')]
    const session = new ArcadeSession({
      mode: 'flags',
      budgetMs: 60_000,
      nextQuestion: (used) => pool.find((q) => !used.has(q.id)) ?? null,
      now: makeClock().now,
    })
    session.start()
    session.answerChoice(0)
    expect(session.prepareNext()).toBeNull()
    session.next()
    expect(session.phase).toBe('done')
  })
})

describe('ArcadeSession — Summary', () => {
  it('zählt nur bewertete Fragen und nur aktive Spielzeit', () => {
    const { clock, session } = choiceSession()
    session.start()

    clock.advance(4000)
    session.answerChoice(0)
    clock.advance(9999) // Feedback-Pause zählt nicht
    session.next()
    clock.advance(6000)
    session.answerChoice(3)
    session.next()

    const s = session.summary()
    expect(s.questionCount).toBe(2)
    expect(s.correctCount).toBe(1)
    expect(s.playedMs).toBe(10_000)
    expect(s.score).toBe(100)
    expect(s.bestStreak).toBe(1)
  })
})
