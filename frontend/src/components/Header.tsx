import { useAuth } from '../state/auth.store'

export default function Header() {
  const user = useAuth((s) => s.user)
  const openModal = useAuth((s) => s.openModal)
  const logout = useAuth((s) => s.logout)
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b bg-white">
      <div className="font-semibold">Projeto LLM</div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button className="px-3 py-1 rounded bg-gray-800 text-white" onClick={() => logout()}>Sair</button>
          </>
        ) : (
          <button className="px-3 py-1 rounded bg-gray-800 text-white" onClick={() => openModal()}>Entrar</button>
        )}
      </div>
    </header>
  )
}
