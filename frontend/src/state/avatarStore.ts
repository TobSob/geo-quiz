import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_AVATAR_ID } from '../features/avatars/avatarCatalog'
import { syncAvatarToServer } from '../api/avatarApi'

/**
 * Gewählter Avatar (Feature-Idee R3). Lokal & offline-tauglich persistiert —
 * genau wie die Sound-Einstellung. Server-Sync für die globale Bestenliste
 * (fremde Avatare) käme später über eine Profil-Spalte (Phase 3).
 */
interface AvatarState {
  avatarId: string
  setAvatar: (id: string) => void
}

export const useAvatarStore = create<AvatarState>()(
  persist(
    (set) => ({
      avatarId: DEFAULT_AVATAR_ID,
      setAvatar: (id) => {
        set({ avatarId: id })
        // Am Profil hinterlegen, damit die Bestenliste ihn allen zeigt (online).
        void syncAvatarToServer(id)
      },
    }),
    { name: 'geo-quiz-avatar' },
  ),
)
