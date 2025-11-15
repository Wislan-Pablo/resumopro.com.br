import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api-client'

export type UploadItem = { id: string; url: string; name?: string }

export function useUploads() {
  return useQuery<UploadItem[]>({
    queryKey: ['uploads'],
    queryFn: async () => {
      const data: any = await api.get('/api/uploads/list')
      const items = Array.isArray(data?.images) ? data.images : []
      return items.map((it: any) => ({ id: it.filename, url: it.url, name: it.filename }))
    },
    initialData: []
  })
}

export function useDeleteUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (filename: string) => {
      await api.post('/api/uploads/delete', { filename })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uploads'] })
    }
  })
}
