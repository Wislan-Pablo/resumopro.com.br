import PdfViewer from '../components/PdfViewer'
import ProtectedRoute from '../components/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import { usePdfList } from '../hooks/usePdfSource'
import { useState, useEffect } from 'react'

export default function PdfPage() {
  const { data = [], isLoading } = usePdfList()
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    if (data.length && !url) setUrl(data[0].url)
  }, [data])
  return (
    <AppLayout>
      <ProtectedRoute>
        <div className={`p-2 md:p-4 lg:p-6 space-y-3 md:space-y-4 ${fullscreen ? 'fixed inset-0 bg-white z-50' : ''}`}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
            <select className="border rounded px-3 py-2 text-sm md:text-base w-full sm:w-auto" value={url || ''} onChange={(e) => setUrl(e.target.value)}>
              {data.map((p) => (
                <option key={p.url} value={p.url}>{p.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="px-3 py-2 md:px-4 md:py-2 rounded bg-gray-800 text-white text-sm md:text-base hover:bg-gray-700 transition-colors flex-1 sm:flex-none" disabled={isLoading || !url} onClick={() => setUrl(url)}>Recarregar</button>
              <button className="px-3 py-2 md:px-4 md:py-2 rounded border text-sm md:text-base hover:bg-gray-50 transition-colors flex-1 sm:flex-none" onClick={() => setFullscreen((f) => !f)}>
                {fullscreen ? 'Sair do fullscreen' : 'Fullscreen'}
              </button>
            </div>
          </div>
          <PdfViewer url={url} />
        </div>
      </ProtectedRoute>
    </AppLayout>
  )
}
