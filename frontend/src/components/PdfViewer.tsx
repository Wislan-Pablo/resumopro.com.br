import { useEffect, useRef } from 'react'

export default function PdfViewer() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // integração Adobe será adicionada na Fase 4
  }, [])
  return <div ref={ref} className="h-[80vh] border rounded" />
}
