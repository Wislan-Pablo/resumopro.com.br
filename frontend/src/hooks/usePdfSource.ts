import { useQuery } from '@tanstack/react-query'

export type PdfItem = { name: string; url: string }

export function usePdfList() {
  return useQuery<PdfItem[]>({
    queryKey: ['pdf-list'],
    queryFn: async () => {
      const res = await fetch('/api/list-pdfs', { credentials: 'include' })
      if (!res.ok) return []
      const data = await res.json()
      const names: string[] = Array.isArray(data?.pdfs) ? data.pdfs : []
      return names.map((name) => ({ name, url: `/temp_uploads/${name}` }))
    },
    initialData: []
  })
}
