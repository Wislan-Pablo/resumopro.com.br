import { useToast } from '../state/toast.store'

export default function ToastContainer() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`min-w-[240px] border rounded shadow px-3 py-2 ${t.type === 'error' ? 'bg-red-50 border-red-300 text-red-800' : t.type === 'success' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-50 border-gray-300 text-gray-800'}`}>
          <div className="flex items-center justify-between">
            <span>{t.message}</span>
            <button className="text-sm" onClick={() => dismiss(t.id)}>x</button>
          </div>
        </div>
      ))}
    </div>
  )
}
