import { describe, it, expect } from 'vitest'
import { api } from './api-client'
import { useToast } from '../state/toast.store'

describe('ApiClient errors', () => {
  it('401 mostra toast e lança UNAUTHORIZED', async () => {
    // @ts-ignore
    global.fetch = async () => ({ ok: false, status: 401, headers: new Headers(), json: async () => ({}) })
    const before = useToast.getState().toasts.length
    await expect(api.get('/me')).rejects.toThrowError('UNAUTHORIZED')
    const after = useToast.getState().toasts.length
    expect(after).toBeGreaterThan(before)
  })
  it('404 mostra toast mapeado', async () => {
    // @ts-ignore
    global.fetch = async () => ({ ok: false, status: 404, headers: new Headers(), json: async () => ({}) })
    const before = useToast.getState().toasts.length
    await expect(api.get('/any')).rejects.toThrowError('HTTP_404')
    const list = useToast.getState().toasts
    const last = list[list.length - 1]
    expect(last?.message).toContain('não encontrado')
  })
})
