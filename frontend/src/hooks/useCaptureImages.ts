import { useQuery } from '@tanstack/react-query'

export type CaptureImage = { id: string; url: string; createdAt?: string }

export function useCaptureImages() {
  return useQuery<CaptureImage[]>({
    queryKey: ['capture-images'],
    queryFn: async () => {
      const res = await fetch('/api/captures/list', { credentials: 'include' })
      if (!res.ok) return []
      const data = await res.json()
      const items = Array.isArray(data?.items) ? data.items : []
      return items as CaptureImage[]
    },
    initialData: []
  })
}
