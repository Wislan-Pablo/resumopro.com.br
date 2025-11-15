import { useEffect, useRef, useState } from 'react'
import { loadAdobeSdk, getAdobeClientId } from '../services/adobe-sdk'
import { useToast } from '../state/toast.store'

export default function PdfViewer({ url }: { url?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const show = useToast((s) => s.show)
  useEffect(() => {
    let view: any
    ;(async () => {
      if (!url || !ref.current) return
      setLoading(true)
      try {
        await loadAdobeSdk()
        const clientId = await getAdobeClientId()
        if (!clientId) { show({ type: 'error', message: 'Adobe Client ID indisponível' }); return }
        const AdobeDC = (window as any).AdobeDC
        view = new AdobeDC.View({ clientId, divId: ref.current.id })
        await view.previewFile({ content: { location: { url } }, metaData: { fileName: 'document.pdf' } })
      } catch (e: any) {
        show({ type: 'error', message: 'Falha ao carregar PDF' })
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      try { view?.close?.() } catch {}
    }
  }, [url])
  return (
    <div className="relative w-full">
      <div id="adobe-view" ref={ref} className="h-[60vh] md:h-[70vh] lg:h-[80vh] border rounded-lg shadow-sm bg-white" />
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
          <div className="px-4 py-3 border rounded-lg bg-white shadow-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            <span className="text-sm font-medium">Carregando PDF...</span>
          </div>
        </div>
      )}
    </div>
  )
}
