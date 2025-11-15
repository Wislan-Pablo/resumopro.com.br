import { create } from 'zustand'

type Toast = { id: number; type: 'error' | 'info' | 'success'; message: string }

interface ToastState {
  toasts: Toast[]
  show: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: Date.now() }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
}))
