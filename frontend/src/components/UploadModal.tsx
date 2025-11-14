import { useGallery } from '../state/gallery.store'
import { useState } from 'react'
import { api } from '../services/api-client'
import { useQueryClient } from '@tanstack/react-query'

export default function UploadModal() {
  const isOpen = useGallery((s) => s.isUploadOpen)
  const close = useGallery((s) => s.closeUpload)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const qc = useQueryClient()
  if (!isOpen) return null
  async function onFilesChange(e: any) {
    setError('')
    setLoading(true)
    try {
      const files: FileList = e.target.files
      const uploads = Array.from(files).map(async (f) => {
        const form = new FormData()
        form.append('file', f)
        await api.upload('/api/uploads/upload', form)
      })
      await Promise.all(uploads)
      qc.invalidateQueries({ queryKey: ['uploads'] })
      close()
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[420px] bg-white border rounded shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Enviar arquivos</h3>
          <button className="text-gray-600" onClick={() => close()}>Fechar</button>
        </div>
        <div className="mt-4 space-y-3">
          <input type="file" multiple onChange={onFilesChange} />
          {loading && <div className="text-sm text-gray-600">Enviando...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  )
}
