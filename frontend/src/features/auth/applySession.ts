import type { AuthInfo } from '../../api/authApi'
import { reconcileAvatar } from '../../api/avatarApi'
import { flushProgress } from '../progress/progressSync'
import { useAvatarStore } from '../../state/avatarStore'
import { useGamificationStore } from '../../state/gamificationStore'
import { useUserStore } from '../../state/userStore'

/**
 * Stellt nach JEDEM Session-Wechsel den kompletten Account-Zustand her —
 * App-Start, E-Mail-Login, Registrierung und Logout laufen alle hierüber
 * (DESIGN-MOBILE-POLISH.md #2: der Login-Pfad setzte früher nur setOnline(),
 * wodurch Level/XP/Abzeichen und der Server-Avatar bis zum nächsten
 * App-Start unsichtbar blieben).
 */
export async function applyAuthSession(auth: AuthInfo | null): Promise<void> {
  const userStore = useUserStore.getState()
  const gamification = useGamificationStore.getState()

  if (!auth) {
    userStore.setOffline()
    gamification.reset()
    return
  }

  userStore.setOnline(auth)
  // Offline-Queue dem (ggf. gerade gewechselten) Account zurechnen.
  void flushProgress()
  // Avatar mit dem Server abgleichen — folgt so dem Account übers Gerät.
  void reconcileAvatar(useAvatarStore.getState().avatarId).then((server) => {
    if (server) useAvatarStore.setState({ avatarId: server })
  })
  // XP/Badges/Pokale gibt es nur für registrierte Accounts (Phase G).
  if (!auth.isAnonymous) {
    gamification.reset()
    await gamification.load()
  } else {
    gamification.reset()
  }
}
