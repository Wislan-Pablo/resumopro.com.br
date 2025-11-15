import { useQuery } from '@tanstack/react-query'

export type CaptureImage = { id: string; url: string; createdAt?: string }

export function useCaptureImages() {
  return useQuery<CaptureImage[]>({
    queryKey: ['capture-images'],
    queryFn: async () => {
      const res = await fetch('/api/captures/list', { credentials: 'include' })
      if (!res.ok) return []
      const data = await res.json()
      return (data as any) as CaptureImage[]
    },
    initialData: []
  })
}
