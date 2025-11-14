import { useState } from 'react'
import { useAuth } from '../state/auth.store'

export default function AuthModal() {
  const isOpen = useAuth((s) => s.isModalOpen)
  const close = useAuth((s) => s.closeModal)
  const login = useAuth((s) => s.login)
  const signup = useAuth((s) => s.signup)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  if (!isOpen) return null
  async function submit() {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await signup(email, password)
    } catch (e: any) {
      setError(e?.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[360px] bg-white border rounded shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{mode === 'login' ? 'Entrar' : 'Cadastrar'}</h3>
          <button className="text-gray-600" onClick={() => close()}>Fechar</button>
        </div>
        <div className="mt-3 space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full border rounded px-3 py-2" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button disabled={loading} className="w-full px-3 py-2 rounded bg-gray-800 text-white" onClick={submit}>{loading ? '...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}</button>
          <button className="w-full px-3 py-2 rounded border" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Criar conta' : 'Já tenho conta'}</button>
        </div>
      </div>
    </div>
  )
}
