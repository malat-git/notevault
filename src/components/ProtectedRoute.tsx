import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type Role } from '../context/AuthContext'

export default function ProtectedRoute({
  allow,
  children,
}: {
  allow: Role[]
  children: ReactNode
}) {
  const { session, role, loading } = useAuth()

  if (loading) {
    return <p className="py-10 text-center text-slate-500">Checking your access...</p>
  }
  if (!session || !role || !allow.includes(role)) {
    return <Navigate to="/admin" replace />
  }
  return <>{children}</>
}