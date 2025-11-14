import { create } from 'zustand'
import { api } from '../services/api-client'

type User = { id: string; email: string; name?: string } | null

interface AuthState {
  user: User
  isModalOpen: boolean
  setUser: (u: User) => void
  openModal: () => void
  closeModal: () => void
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isModalOpen: false,
  setUser: (u) => set({ user: u }),
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  login: async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    set({ user: data as any, isModalOpen: false })
  },
  signup: async (email, password) => {
    const data = await api.post('/auth/signup', { email, password })
    set({ user: data as any, isModalOpen: false })
  },
  logout: async () => {
    await api.post('/auth/logout', {})
    set({ user: null })
  }
}))
