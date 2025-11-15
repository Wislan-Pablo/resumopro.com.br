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
    <div className="relative">
      <div id="adobe-view" ref={ref} className="h-[80vh] border rounded" />
      {loading && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><div className="px-3 py-2 border rounded bg-white">Carregando PDF...</div></div>}
    </div>
  )
}
