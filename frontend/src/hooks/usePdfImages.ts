import { useQuery } from '@tanstack/react-query'

export type GalleryImage = { id: string; url: string; page?: number }

export function usePdfImages() {
  return useQuery<GalleryImage[]>({
    queryKey: ['pdf-images'],
    queryFn: async () => {
      const res = await fetch('/api/pdf-images/list', { credentials: 'include' })
      if (!res.ok) return []
      const data = await res.json()
      return (data as any) as GalleryImage[]
    },
    initialData: []
  })
}
