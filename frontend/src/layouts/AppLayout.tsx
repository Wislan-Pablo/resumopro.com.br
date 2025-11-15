import { ReactNode } from 'react'
import Header from '../components/Header'
import AuthModal from '../components/AuthModal'
import { useMe } from '../hooks/useMe'
import ToastContainer from '../components/ToastContainer'

export default function AppLayout({ children }: { children: ReactNode }) {
  useMe()
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {children}
      <AuthModal />
      <ToastContainer />
    </div>
  )
}
