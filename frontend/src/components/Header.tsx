import { useAuth } from '../state/auth.store'

export default function Header() {
  const user = useAuth((s) => s.user)
  const openModal = useAuth((s) => s.openModal)
  const logout = useAuth((s) => s.logout)
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm">
      <div className="font-semibold text-lg md:text-xl">Projeto LLM</div>
      <div className="flex items-center gap-2 md:gap-3">
        {user ? (
          <>
            <span className="hidden sm:block text-sm text-gray-600 truncate max-w-[150px] md:max-w-[200px]">{user?.email}</span>
            <button className="px-3 py-1.5 md:px-4 md:py-2 rounded bg-gray-800 text-white text-sm md:text-base hover:bg-gray-700 transition-colors" onClick={() => logout()}>Sair</button>
          </>
        ) : (
          <button className="px-3 py-1.5 md:px-4 md:py-2 rounded bg-gray-800 text-white text-sm md:text-base hover:bg-gray-700 transition-colors" onClick={() => openModal()}>Entrar</button>
        )}
      </div>
    </header>
  )
}
