import JoditEditor from 'jodit-react'
import { useEffect, useRef, useState } from 'react'
import { useEditorData, useSaveSummary } from '../hooks/useEditorData'
import { api } from '../services/api-client'
import { sanitizeHtml } from '../utils/html'
import { useQueryClient } from '@tanstack/react-query'
import { useEditorStore } from '../state/editor.store'

export default function Editor() {
  const { data, isLoading } = useEditorData()
  const save = useSaveSummary()
  const qc = useQueryClient()
  const setInsertImage = useEditorStore((s) => s.setInsertImage)
  const [value, setValue] = useState('')
  const timer = useRef<any>(null)
  useEffect(() => { setValue(sanitizeHtml(data || '')) }, [data])
  function onChange(v: string) {
    setValue(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { save.mutate(v) }, 600)
  }
  useEffect(() => {
    setInsertImage((url: string) => {
      const html = `<img src="${url}" />`
      // @ts-ignore
      const editor = (editorRef.current as any)?.editor
      if (editor) editor.selection.insertHTML(html)
    })
  }, [])
  const editorRef = useRef<any>(null)
  async function handlePaste(e: any) {
    try {
      const items: DataTransferItemList = e?.clipboardData?.items
      if (!items) return
      const images: Blob[] = []
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const file = it.getAsFile()
          if (file) images.push(file)
        }
      }
      if (!images.length) return
      e.preventDefault()
      for (const image of images) {
        const form = new FormData()
        form.append('file', image)
        const data: any = await api.upload('/api/upload-captured-image', form)
        const url = typeof data === 'string' ? data : data?.url || data?.file?.url
        if (url) {
          // insert immediately
          // @ts-ignore
          const editor = (editorRef.current as any)?.editor
          if (editor) editor.selection.insertHTML(`<img src="${url}" />`)
        }
      }
      qc.invalidateQueries({ queryKey: ['uploads'] })
    } catch {}
  }
  if (isLoading) return <div className="text-gray-600">Carregando editor...</div>
  return (
    <div className="max-w-4xl">
      <JoditEditor ref={editorRef} value={value} onChange={onChange} config={{ events: { paste: handlePaste } }} />
    </div>
  )
}
