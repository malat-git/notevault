import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type Role = 'user' | 'contributor' | 'admin'

export interface AuthState {
  session: Session | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}