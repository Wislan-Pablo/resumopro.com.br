import * as ReactWindow from 'react-window'
import { useGallery } from '../state/gallery.store'
import { useUploads, useDeleteUpload } from '../hooks/useUploads'

export default function Gallery() {
  const mode = useGallery((s) => s.mode)
  const setMode = useGallery((s) => s.setMode)
  const openUpload = useGallery((s) => s.openUpload)
  const { data: items = [], isLoading } = useUploads()
  const del = useDeleteUpload()
  const cols = 3
  const rows = Math.ceil(items.length / cols)
  const List: any = (ReactWindow as any).FixedSizeList
  const Row = ({ index, style }: any) => {
    const start = index * cols
    const slice = items.slice(start, start + cols)
    return (
      <div style={style} className="flex">
        {slice.map((it) => (
          <div key={it.id} className="p-2 w-[180px]">
            <div className="border rounded overflow-hidden">
              <img src={it.url} loading="lazy" className="w-full h-36 object-cover" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm truncate max-w-[140px]">{it.name || it.id}</span>
              <button className="text-xs px-2 py-1 border rounded" onClick={() => del.mutate(it.id)}>Excluir</button>
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
        <div className="ml-auto">
          <button className="px-2 py-1 rounded bg-gray-800 text-white" onClick={() => openUpload()}>Enviar</button>
        </div>
      </div>
      {isLoading ? (
        <div className="text-gray-600 p-3">Carregando...</div>
      ) : (
        <List height={600} itemCount={rows} itemSize={200} width={540}>
          {Row as any}
        </List>
      )}
    </div>
  )
}
