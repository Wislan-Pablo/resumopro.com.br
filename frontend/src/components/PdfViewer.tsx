import { useEffect, useRef } from 'react'
import { loadAdobeSdk, getAdobeClientId } from '../services/adobe-sdk'

export default function PdfViewer({ url }: { url?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let view: any
    ;(async () => {
      if (!url || !ref.current) return
      await loadAdobeSdk()
      const clientId = await getAdobeClientId()
      if (!clientId) return
      const AdobeDC = (window as any).AdobeDC
      view = new AdobeDC.View({ clientId, divId: ref.current.id })
      await view.previewFile({ content: { location: { url } }, metaData: { fileName: 'document.pdf' } })
    })()
    return () => {
      try { view?.close?.() } catch {}
    }
  }, [url])
  return <div id="adobe-view" ref={ref} className="h-[80vh] border rounded" />
}
