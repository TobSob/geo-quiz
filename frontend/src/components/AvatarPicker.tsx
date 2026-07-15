import { useAvatarStore } from '../state/avatarStore'
import { useUserStore } from '../state/userStore'
import { useUnlockContext } from '../features/avatars/useAvatarUnlocks'
import {
  AVATARS,
  isAvatarUnlocked,
  unlockLabel,
} from '../features/avatars/avatarCatalog'
import { PixelAvatar } from './PixelAvatar'

  AVATARS_BY_LEVEL,
 * Avatar-Auswahl (Feature-Idee R3): Starter sind immer wählbar, gesperrte
 * zeigen ausgegraut ihre Freischalt-Bedingung. Auswahl liegt lokal.
 */
export function AvatarPicker() {
  const avatarId = useAvatarStore((s) => s.avatarId)
  const setAvatar = useAvatarStore((s) => s.setAvatar)
  const status = useUserStore((s) => s.status)
  const isAnonymous = useUserStore((s) => s.isAnonymous)
  const ctx = useUnlockContext()
  // Level & Erfolge — und damit alle Freischaltungen — gibt es nur mit Account.
  const hasAccount = status === 'online' && !isAnonymous

  return (
    <div className="pixel-panel stack" style={{ padding: 20, gap: 12 }}>
      <h3 className="glow-cyan">🎭 Avatar</h3>
      <p className="dim" style={{ margin: 0, fontSize: 18 }}>
        Wähle deinen Pixel-Avatar — er erscheint im Menü und auf deiner Zeile in
      <div className="avatar-grid">
        {AVATARS_BY_LEVEL.map((spec) => {
          ? 'Weitere schaltest du mit Level und Erfolgen frei.'
          : 'Weitere Avatare gibt es mit einem Account (Level & Erfolge).'}
      </p>
      <div className="avatar-grid">
        {AVATARS.map((spec) => {
          const unlocked = isAvatarUnlocked(spec, ctx)
          const selected = spec.id === avatarId
          // Gäste können nichts freischalten → einheitlicher Account-Hinweis
          // statt einer Level-Angabe, die sie nie erreichen.
          const hint =
            spec.unlock.kind === 'starter'
              ? unlockLabel(spec)
              : hasAccount
                ? unlockLabel(spec)
                : 'Nur mit Account'
          return (
            <button
              key={spec.id}
              type="button"
              className={`avatar-tile${selected ? ' avatar-tile--selected' : ''}${
                unlocked ? '' : ' avatar-tile--locked'
              }`}
              disabled={!unlocked}
              title={unlocked ? spec.name : `${spec.name} — ${hint}`}
              onClick={() => unlocked && setAvatar(spec.id)}
            >
              <PixelAvatar id={spec.id} size={48} locked={!unlocked} />
              <span className="avatar-tile-name">
                {unlocked ? spec.name : `🔒 ${hint}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
