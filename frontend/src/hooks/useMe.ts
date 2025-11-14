import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api-client'
import { useAuth } from '../state/auth.store'
import { useEffect } from 'react'

export function useMe() {
  const setUser = useAuth((s) => s.setUser)
  const openModal = useAuth((s) => s.openModal)
  const q = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/me'),
    staleTime: 60_000,
    retry: 0
  })
  useEffect(() => {
    if (q.data) setUser(q.data as any)
  }, [q.data])
  useEffect(() => {
    const e = q.error as any
    if (e?.message === 'UNAUTHORIZED') {
      setUser(null)
      openModal()
    }
  }, [q.error])
  return q
}
