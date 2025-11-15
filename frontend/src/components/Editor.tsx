import JoditEditor from 'jodit-react'
import { useEffect, useRef, useState } from 'react'
import { useEditorData, useSaveSummary } from '../hooks/useEditorData'
import { sanitizeHtml } from '../utils/html'

export default function Editor() {
  const { data, isLoading } = useEditorData()
  const save = useSaveSummary()
  const [value, setValue] = useState('')
  const timer = useRef<any>(null)
  useEffect(() => { setValue(sanitizeHtml(data || '')) }, [data])
  function onChange(v: string) {
    setValue(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { save.mutate(v) }, 600)
  }
  if (isLoading) return <div className="text-gray-600">Carregando editor...</div>
  return (
    <div className="max-w-4xl">
      <JoditEditor value={value} onChange={onChange} />
    </div>
  )
}
