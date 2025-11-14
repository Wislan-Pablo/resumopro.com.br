import PdfViewer from '../components/PdfViewer'
import ProtectedRoute from '../components/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'

export default function PdfPage() {
  return (
    <AppLayout>
      <ProtectedRoute>
        <div className="p-4">
          <PdfViewer />
        </div>
      </ProtectedRoute>
    </AppLayout>
  )
}
