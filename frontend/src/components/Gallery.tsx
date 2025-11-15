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
  const cols = 3
  const activeItems = mode === 'uploads' ? uploads : mode === 'pdf' ? pdfImages : captureImages
  const [visible, setVisible] = (window as any).React?.useState ? (window as any).React.useState(60) : [60, () => {}]
  const visibleItems = activeItems.slice(0, visible as number)
  const rows = Math.ceil(activeItems.length / cols)
  const List: any = (ReactWindow as any).FixedSizeList
  const show = useToast((s) => s.show)
  const Row = ({ index, style }: any) => {
    const start = index * cols
    const slice = visibleItems.slice(start, start + cols)
    return (
      <div style={style} className="flex">
        {slice.map((it) => (
          <div key={it.id} className="p-2 w-[180px]">
            <div className="border rounded overflow-hidden">
              <img src={it.url} loading="lazy" className="w-full h-36 object-cover" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm truncate max-w-[140px]">{(it as any).name || it.id}</span>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 border rounded" onClick={() => { insertImage?.(it.url); show({ type: 'success', message: 'Imagem copiada para o editor' }) }}>Copiar</button>
                {mode === 'uploads' && (
                  <button className="text-xs px-2 py-1 border rounded" onClick={() => del.mutate(it.id, { onSuccess: () => show({ type: 'success', message: 'Upload excluído' }) })}>Excluir</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {slice.length < cols && Array.from({ length: cols - slice.length }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2 w-[180px]" />
        ))}
      </div>
    )
  }
  return (
    <div className="p-2">
      <div className="flex items-center gap-2 mb-2">
        <button className={`px-2 py-1 rounded border ${mode === 'pdf' ? 'bg-gray-800 text-white' : ''}`} onClick={() => setMode('pdf')}>PDF</button>
        <button className={`px-2 py-1 rounded border ${mode === 'captures' ? 'bg-gray-800 text-white' : ''}`} onClick={() => setMode('captures')}>Capturas</button>
        <button className={`px-2 py-1 rounded border ${mode === 'uploads' ? 'bg-gray-800 text-white' : ''}`} onClick={() => setMode('uploads')}>Uploads</button>
        <span className="ml-2 text-sm text-gray-600">
          {mode === 'uploads' ? `${uploads.length} itens` : mode === 'pdf' ? `${pdfImages.length} itens` : `${captureImages.length} itens`}
        </span>
        <div className="ml-auto">
          {mode === 'uploads' && (
            <button className="px-2 py-1 rounded bg-gray-800 text-white" onClick={() => openUpload()}>Enviar</button>
          )}
        </div>
      </div>
      {loadingUploads || loadingPdf || loadingCaptures ? (
        <div className="text-gray-600 p-3">Carregando...</div>
      ) : (visibleItems.length === 0) ? (
        <div className="text-gray-500 p-3">Nenhum item encontrado.</div>
      ) : (
        <List height={600} itemCount={Math.ceil(visibleItems.length / cols)} itemSize={200} width={540}>
          {Row as any}
        </List>
      )}
      {activeItems.length > (visible as number) && (
        <div className="p-2">
          <button className="px-3 py-1 rounded border" onClick={() => setVisible((visible as number) + 60)}>Carregar mais</button>
        </div>
      )}
    </div>
  )
}
