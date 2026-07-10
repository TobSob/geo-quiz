interface Props {
  streak: number
}

export function StreakBadge({ streak }: Props) {
  if (streak < 2) return null
  return (
    <span className={`streak-badge${streak >= 5 ? ' streak-badge--hot' : ''}`}>
      {streak >= 5 ? '🔥' : '⚡'} {streak}x
    </span>
  )
}
