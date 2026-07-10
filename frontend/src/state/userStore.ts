import { create } from 'zustand'
import type { AuthInfo } from '../api/authApi'

export type OnlineStatus = 'offline' | 'connecting' | 'online'

interface UserState {
  status: OnlineStatus
  userId: string | null
  displayName: string | null
  isAnonymous: boolean
  email: string | null
  setOnline: (auth: AuthInfo) => void
  setOffline: () => void
  setConnecting: () => void
  setDisplayName: (name: string) => void
}

export const useUserStore = create<UserState>((set) => ({
  status: 'offline',
  userId: null,
  displayName: null,
  isAnonymous: true,
  email: null,
  setOnline: ({ userId, displayName, isAnonymous, email }) =>
    set({ status: 'online', userId, displayName, isAnonymous, email }),
  setOffline: () =>
    set({
      status: 'offline',
      userId: null,
      displayName: null,
      isAnonymous: true,
      email: null,
    }),
  setConnecting: () => set({ status: 'connecting' }),
  setDisplayName: (displayName) => set({ displayName }),
}))
