import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../state/auth.store'

export default function LoginPage() {
  const open = useAuth((s) => s.openModal)
  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="p-6 bg-white border rounded shadow-sm">
          <h2 className="text-xl font-semibold">Entrar</h2>
          <p className="text-gray-600 mt-2">Use o modal para autenticar.</p>
          <button className="mt-4 px-4 py-2 rounded bg-gray-800 text-white" onClick={() => open()}>Abrir modal</button>
        </div>
      </div>
    </AppLayout>
  )
}
