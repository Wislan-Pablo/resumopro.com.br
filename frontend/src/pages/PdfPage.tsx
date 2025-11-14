import PdfViewer from '../components/PdfViewer'
import ProtectedRoute from '../components/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import { usePdfList } from '../hooks/usePdfSource'
import { useState, useEffect } from 'react'

export default function PdfPage() {
  const { data = [], isLoading } = usePdfList()
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (data.length && !url) setUrl(data[0].url)
  }, [data])
  return (
    <AppLayout>
      <ProtectedRoute>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <select className="border rounded px-2 py-1" value={url || ''} onChange={(e) => setUrl(e.target.value)}>
              {data.map((p) => (
                <option key={p.url} value={p.url}>{p.name}</option>
              ))}
            </select>
            <button className="px-3 py-1 rounded bg-gray-800 text-white" disabled={isLoading || !url} onClick={() => setUrl(url)}>Recarregar</button>
          </div>
          <PdfViewer url={url} />
        </div>
      </ProtectedRoute>
    </AppLayout>
  )
}
