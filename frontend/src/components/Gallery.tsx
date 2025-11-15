import { useState, useEffect } from 'react'
import * as ReactWindow from 'react-window'
import { useGallery } from '../state/gallery.store'
import { useUploads, useDeleteUpload } from '../hooks/useUploads'
import { usePdfImages } from '../hooks/usePdfImages'
import { useCaptureImages } from '../hooks/useCaptureImages'
import { useEditorStore } from '../state/editor.store'
import { useToast } from '../state/toast.store'

export default function Gallery() {
  const mode = useGallery((s) => s.mode)
  const setMode = useGallery((s) => s.setMode)
  const openUpload = useGallery((s) => s.openUpload)
  const insertImage = useEditorStore((s) => s.insertImage)
  const { data: uploads = [], isLoading: loadingUploads } = useUploads()
  const { data: pdfImages = [], isLoading: loadingPdf } = usePdfImages()
  const { data: captureImages = [], isLoading: loadingCaptures } = useCaptureImages()
  const del = useDeleteUpload()
  
  // Responsividade: ajustar número de colunas baseado no tamanho da tela
  const [cols, setCols] = useState(3)
  const [listHeight, setListHeight] = useState(600)
  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth
      if (width < 640) setCols(2) // Mobile
      else if (width < 1024) setCols(3) // Tablet
      else setCols(4) // Desktop
      
      // Calculate appropriate list height based on viewport
      setListHeight(Math.min(600, Math.max(400, window.innerHeight - 250)))
    }
    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])
  
  const activeItems = mode === 'uploads' ? uploads : mode === 'pdf' ? pdfImages : captureImages
  const [visible, setVisible] = useState(60)
  const visibleItems = activeItems.slice(0, visible)
  const rows = Math.ceil(activeItems.length / cols)
  const FixedSizeList: any = (ReactWindow as any).FixedSizeList
  const show = useToast((s) => s.show)
  
  const Row = ({ index, style }: any) => {
    const start = index * cols
    const slice = visibleItems.slice(start, start + cols)
    return (
      <div style={style} className="flex px-2">
        {slice.map((it) => (
          <div key={it.id} className={`p-1 md:p-2 ${cols === 2 ? 'w-1/2' : cols === 3 ? 'w-1/3' : 'w-1/4'}`}>
            <div className="border rounded overflow-hidden hover:shadow-md transition-shadow bg-white">
              <img src={it.url} loading="lazy" className="w-full h-24 sm:h-28 md:h-32 lg:h-36 object-cover" />
            </div>
            <div className="mt-1 md:mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
              <span className="text-xs md:text-sm truncate max-w-full">{(it as any).name || it.id}</span>
              <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50 transition-colors" onClick={() => { insertImage?.(it.url); show({ type: 'success', message: 'Imagem copiada para o editor' }) }}>Copiar</button>
                {mode === 'uploads' && (
                  <button className="text-xs px-2 py-1 border rounded hover:bg-red-50 transition-colors text-red-600" onClick={() => del.mutate(it.id, { onSuccess: () => show({ type: 'success', message: 'Upload excluído' }) })}>Excluir</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {slice.length < cols && Array.from({ length: cols - slice.length }).map((_, i) => (
          <div key={`empty-${i}`} className={`p-1 md:p-2 ${cols === 2 ? 'w-1/2' : cols === 3 ? 'w-1/3' : 'w-1/4'}`} />
        ))}
      </div>
    )
  }
  return (
    <div className="p-2 md:p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-2">
          <button className={`px-3 py-2 rounded border text-sm ${mode === 'pdf' ? 'bg-gray-800 text-white' : ''}`} onClick={() => setMode('pdf')}>PDF</button>
          <button className={`px-3 py-2 rounded border text-sm ${mode === 'captures' ? 'bg-gray-800 text-white' : ''}`} onClick={() => setMode('captures')}>Capturas</button>
          <button className={`px-3 py-2 rounded border text-sm ${mode === 'uploads' ? 'bg-gray-800 text-white' : ''}`} onClick={() => setMode('uploads')}>Uploads</button>
        </div>
        <span className="text-sm text-gray-600">
          {mode === 'uploads' ? `${uploads.length} itens` : mode === 'pdf' ? `${pdfImages.length} itens` : `${captureImages.length} itens`}
        </span>
        <div className="ml-auto">
          {mode === 'uploads' && (
            <button className="px-3 py-2 rounded bg-gray-800 text-white text-sm" onClick={() => openUpload()}>Enviar</button>
          )}
        </div>
      </div>
      {loadingUploads || loadingPdf || loadingCaptures ? (
        <div className="text-gray-600 p-3">Carregando...</div>
      ) : (visibleItems.length === 0) ? (
        <div className="text-gray-500 p-3">Nenhum item encontrado.</div>
      ) : (
        <div className="w-full">
          <FixedSizeList
            height={listHeight} 
            itemCount={Math.ceil(visibleItems.length / cols)} 
            itemSize={180} 
            width="100%"
            className="w-full"
          >
            {Row as any}
          </FixedSizeList>
        </div>
      )}
      {activeItems.length > visible && (
        <div className="p-2 text-center">
          <button className="px-4 py-2 rounded border hover:bg-gray-50 transition-colors" onClick={() => setVisible(visible + 60)}>Carregar mais</button>
        </div>
      )}
    </div>
  )
}
