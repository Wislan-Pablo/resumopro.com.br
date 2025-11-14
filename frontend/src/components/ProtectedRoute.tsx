import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../state/auth.store'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const loc = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return <>{children}</>
}
