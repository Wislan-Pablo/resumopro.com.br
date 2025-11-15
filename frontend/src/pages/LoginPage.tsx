import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../state/auth.store'

export default function LoginPage() {
  const open = useAuth((s) => s.openModal)
  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 md:p-8 bg-white border rounded-lg shadow-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-center">Entrar</h2>
          <p className="text-gray-600 mt-2 text-center">Use o modal para autenticar.</p>
          <button className="mt-6 w-full px-4 py-2 md:px-6 md:py-3 rounded bg-gray-800 text-white hover:bg-gray-700 transition-colors" onClick={() => open()}>Abrir modal</button>
        </div>
      </div>
    </AppLayout>
  )
}
