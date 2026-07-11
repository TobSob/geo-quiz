import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdaptiveSampler } from '../features/quiz-engine/adaptiveSampler'
import {
  deterministicId,
  questionFromId,
  quizPool,
} from '../features/quiz-engine/questionGenerator'
import type { Question, QuestionProgress } from '../features/quiz-engine/types'
import { cities, countries, dataBundle, landmarks, outlineRenderableIso2 } from '../data'
import { QuizView } from '../components/QuizView'
import { useProgressStore } from '../state/progressStore'

const TRAINING_QUESTIONS = 12

/** Every askable question ID across all modes — the sampler's universe. */
function questionUniverse(): string[] {
  const ids: string[] = []
  for (const c of quizPool(countries)) {
    ids.push(deterministicId('flags', c.iso2))
    ids.push(deterministicId('capitals', c.iso2))
    ids.push(deterministicId('countries', c.iso2))
    if (outlineRenderableIso2.has(c.iso2)) ids.push(deterministicId('outline', c.iso2))
  }
  for (const city of cities) ids.push(deterministicId('city-pin', city.id))
  for (const lm of landmarks) ids.push(deterministicId('landmark-pin', lm.id))
  return ids
}

function sampleQuestions(
  progressById: Record<string, QuestionProgress>,
): Question[] {
  const sampler = new AdaptiveSampler(
    questionUniverse(),
    new Map(Object.entries(progressById)),
  )
  const questions: Question[] = []
  const seen = new Set<string>()
  let guard = 0
  while (questions.length < TRAINING_QUESTIONS && guard < 200) {
    guard++
    const id = sampler.nextQuestionId()
    if (seen.has(id)) continue
    const q = questionFromId(id, dataBundle)
    if (!q) continue
    seen.add(id)
    questions.push(q)
  }
  return questions
}

export function TrainingScreen() {
  const navigate = useNavigate()
  const progressById = useProgressStore((s) => s.progressById)
  const [runKey, setRunKey] = useState(0)

  // Sample once per run — not on every progress update mid-session.
  const questions = useMemo(
    () => sampleQuestions(progressById),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runKey],
  )

  const answeredCount = Object.keys(progressById).length

  return (
    <div className="stack">
      <p className="dim center" style={{ margin: 0 }}>
        🎯 Adaptives Training — schwache Fragen kommen öfter. ({answeredCount}{' '}
        Fragen im Lernverlauf)
      </p>
      <QuizView
        key={runKey}
        mode="training"
        questions={questions}
        title="Training"
        onDone={() => {}}
        onExit={() => navigate('/')}
        onReplay={() => setRunKey((k) => k + 1)}
      />
    </div>
  )
}
