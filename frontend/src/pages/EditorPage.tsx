import Gallery from '../components/Gallery'
import Editor from '../components/Editor'
import ProtectedRoute from '../components/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import UploadModal from '../components/UploadModal'

export default function EditorPage() {
  return (
    <AppLayout>
      <ProtectedRoute>
        <div className="grid grid-cols-[280px_1fr]">
          <aside className="border-r bg-white">
            <div className="p-3 font-semibold">Galeria</div>
            <Gallery />
          </aside>
          <main className="p-4">
            <Editor />
          </main>
        </div>
      </ProtectedRoute>
      <UploadModal />
    </AppLayout>
  )
}
