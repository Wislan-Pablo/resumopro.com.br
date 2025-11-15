import Gallery from '../components/Gallery'
import Editor from '../components/Editor'
import ProtectedRoute from '../components/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import UploadModal from '../components/UploadModal'

export default function EditorPage() {
  return (
    <AppLayout>
      <ProtectedRoute>
        <div className="flex flex-col xl:grid xl:grid-cols-[320px_1fr] min-h-[calc(100vh-64px)]">
          <aside className="border-r bg-white w-full xl:w-auto order-2 xl:order-1">
            <div className="p-3 font-semibold text-sm md:text-base border-b">Galeria</div>
            <div className="h-[300px] md:h-[400px] xl:h-[calc(100vh-120px)] overflow-y-auto">
              <Gallery />
            </div>
          </aside>
          <main className="p-2 md:p-4 lg:p-6 flex-1 order-1 xl:order-2 min-h-[400px] xl:min-h-0">
            <Editor />
          </main>
        </div>
      </ProtectedRoute>
      <UploadModal />
    </AppLayout>
  )
}
