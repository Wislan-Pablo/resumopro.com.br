import { createBrowserRouter } from 'react-router-dom'
import EditorPage from '../pages/EditorPage'
import PdfPage from '../pages/PdfPage'
import LoginPage from '../pages/LoginPage'

export const router = createBrowserRouter([
  { path: '/', element: <EditorPage /> },
  { path: '/editor', element: <EditorPage /> },
  { path: '/pdf', element: <PdfPage /> },
  { path: '/login', element: <LoginPage /> }
])
