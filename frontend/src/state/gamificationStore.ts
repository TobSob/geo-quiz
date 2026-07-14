import { create } from 'zustand'
import {
  fetchGamification,
  type GamificationData,
  type OwnedBadge,
  type OwnedTrophy,
  type PlayerStats,
  type UnlockPayload,
} from '../api/gamificationApi'

/**
 * Gamification-Stand des angemeldeten Accounts (Phase G). Nicht persistiert
 * (Muster userStore): die Wahrheit liegt auf dem Server, geladen nach dem
 * Login und optimistisch fortgeschrieben, wenn eine Abgabe eine
 * Unlock-Payload zurückbringt (Header-Chip springt sofort).
 */

export type GamificationStatus = 'idle' | 'loading' | 'ready'

interface GamificationState {
  status: GamificationStatus
  /** XP-Kontostand; 0 solange nichts geladen ist. */
  xp: number
  stats: PlayerStats | null
  badges: OwnedBadge[]
  trophies: OwnedTrophy[]
  load: () => Promise<void>
  applyUnlock: (payload: UnlockPayload) => void
  reset: () => void
}

let inFlight: Promise<GamificationData | null> | null = null

export const useGamificationStore = create<GamificationState>((set, get) => ({
  status: 'idle',
  xp: 0,
  stats: null,
  badges: [],
  trophies: [],

  load: async () => {
    if (get().status === 'loading') return
    set({ status: 'loading' })
    inFlight ??= fetchGamification()
    const data = await inFlight
    inFlight = null
    if (data) {
      set({
        status: 'ready',
        xp: data.stats.xp,
        stats: data.stats,
        badges: data.badges,
        trophies: data.trophies,
      })
    } else {
      // Gast, offline oder frischer Account ohne Stats-Zeile: leerer Stand.
      set({ status: 'ready', xp: 0, stats: null, badges: [], trophies: [] })
    }
  },

  applyUnlock: (payload) => {
    const { badges } = get()
    const known = new Set(badges.map((b) => `${b.badgeId}:${b.tier}`))
    const now = new Date().toISOString()
    const added: OwnedBadge[] = payload.newBadges
      .filter((b) => !known.has(`${b.badgeId}:${b.tier}`))
      .map((b) => ({ badgeId: b.badgeId, tier: b.tier, awardedAt: now }))
    set({
      xp: Math.max(get().xp, payload.xpTotal),
      badges: added.length > 0 ? [...badges, ...added] : badges,
    })
  },

  reset: () =>
    set({ status: 'idle', xp: 0, stats: null, badges: [], trophies: [] }),
}))
