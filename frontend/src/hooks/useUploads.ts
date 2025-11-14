import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api-client'

export type UploadItem = {
  id: string
  url: string
  name?: string
  size?: number
}

export function useUploads() {
  return useQuery<UploadItem[]>({
    queryKey: ['uploads'],
    queryFn: async () => {
      const data = await api.get('/api/uploads/list')
      return (data as any) as UploadItem[]
    },
    initialData: []
  })
}

export function useDeleteUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post('/api/uploads/delete', { id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uploads'] })
    }
  })
}
