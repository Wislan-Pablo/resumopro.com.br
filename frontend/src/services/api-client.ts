const originBase = typeof window !== 'undefined' ? window.location.origin : ''
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || originBase

import { useToast } from '../state/toast.store'

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init
  })
  if (res.status === 401) {
    useToast.getState().show({ type: 'error', message: 'Sessão expirada. Faça login novamente.' })
    throw new Error('UNAUTHORIZED')
  }
  if (!res.ok) {
    const msg = res.status === 404 ? 'Recurso não encontrado.' : res.status >= 500 ? 'Erro no servidor.' : 'Erro na requisição.'
    useToast.getState().show({ type: 'error', message: msg })
    throw new Error(`HTTP_${res.status}`)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const api = {
  get: (p: string) => request(p),
  post: (p: string, body: any) => request(p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }),
  upload: (p: string, form: FormData) => request(p, {
    method: 'POST',
    body: form
  })
}

export type ApiError = 'UNAUTHORIZED' | `HTTP_${number}`
