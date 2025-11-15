import { create } from 'zustand'

interface EditorState {
  insertImage?: (url: string) => void
  setInsertImage: (fn: (url: string) => void) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  insertImage: undefined,
  setInsertImage: (fn) => set({ insertImage: fn })
}))
