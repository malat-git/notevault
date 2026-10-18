import { useAuth } from '../context/AuthContext'

export default function AdminDashboard() {
  const { session, role, signOut } = useAuth()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Signed in as <span className="font-medium">{session?.user.email}</span> (
            {role})
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>

      <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        Uploads, note management, categories and statistics will appear here in the
        next phases.
      </p>
    </div>
  )
}