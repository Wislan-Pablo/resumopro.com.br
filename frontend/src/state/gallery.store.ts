import { create } from 'zustand'

type Mode = 'uploads' | 'pdf' | 'captures'

interface GalleryState {
  mode: Mode
  isUploadOpen: boolean
  setMode: (m: Mode) => void
  openUpload: () => void
  closeUpload: () => void
}

export const useGallery = create<GalleryState>((set) => ({
  mode: 'uploads',
  isUploadOpen: false,
  setMode: (m) => set({ mode: m }),
  openUpload: () => set({ isUploadOpen: true }),
  closeUpload: () => set({ isUploadOpen: false })
}))
