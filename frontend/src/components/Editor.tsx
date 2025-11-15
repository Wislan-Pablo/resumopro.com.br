import JoditEditor from 'jodit-react'
import { useEffect, useRef, useState } from 'react'
import { useEditorData, useSaveSummary } from '../hooks/useEditorData'
import { sanitizeHtml } from '../utils/html'
import { useQueryClient } from '@tanstack/react-query'

export default function Editor() {
  const { data, isLoading } = useEditorData()
  const save = useSaveSummary()
  const qc = useQueryClient()
  const [value, setValue] = useState('')
  const timer = useRef<any>(null)
  useEffect(() => { setValue(sanitizeHtml(data || '')) }, [data])
  function onChange(v: string) {
    setValue(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { save.mutate(v) }, 600)
  }
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
        await fetch('/api/upload-captured-image', { method: 'POST', body: form, credentials: 'include' })
      }
      qc.invalidateQueries({ queryKey: ['uploads'] })
    } catch {}
  }
  if (isLoading) return <div className="text-gray-600">Carregando editor...</div>
  return (
    <div className="max-w-4xl">
      <JoditEditor value={value} onChange={onChange} config={{ events: { paste: handlePaste } }} />
    </div>
  )
}
