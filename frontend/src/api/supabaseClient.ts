import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Plain localStorage isn't reliably durable inside the Android WebView
 * (OS storage eviction, OEM battery-optimization data clearing, ...) — the
 * anonymous identity would randomly reset across app restarts. Preferences
 * uses native SharedPreferences on Android and falls back to localStorage
 * on web, so this is a drop-in replacement either way.
 */
const capacitorStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value })
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key })
  },
}

/**
 * Null when env vars are missing — the game then runs fully offline
 * (local scores + progress only, no global leaderboard).
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { storage: capacitorStorage } })
    : null

export const isOnlineEnabled = supabase !== null
