import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../services/api-client'

export function useEditorData() {
  return useQuery<string>({
    queryKey: ['editor-data'],
    queryFn: async () => {
      const data = await api.get('/api/get-editor-data')
      return (data as any)?.html || ''
    },
    initialData: ''
  })
}

export function useSaveSummary() {
  return useMutation({
    mutationFn: async (html: string) => {
      await api.post('/api/save-structured-summary', { html })
    }
  })
}
