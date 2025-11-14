import { useQuery } from '@tanstack/react-query'

export type PdfItem = { name: string; url: string }

export function usePdfList() {
  return useQuery<PdfItem[]>({
    queryKey: ['pdf-list'],
    queryFn: async () => {
      const res = await fetch('/api/list-pdfs', { credentials: 'include' })
      if (!res.ok) return []
      const data = await res.json()
      return (data as any) as PdfItem[]
    },
    initialData: []
  })
}
