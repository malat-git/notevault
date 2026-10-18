import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

interface Stats {
  total_notes: number
  published: number
  pending: number
  rejected: number
  total_files: number
  total_downloads: number
  uploads_last_30_days: number
  open_reports: number
  storage_bytes: number
}

interface TopNote {
  id: string
  title: string
  download_count: number
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

const linkCard =
  'rounded-xl border border-slate-200 bg-white p-4 text-center font-semibold text-sky-800 shadow-sm hover:border-sky-300 hover:bg-sky-50'

export default function AdminDashboard() {
  const { session, role, signOut } = useAuth()
  const isAdmin = role === 'admin'

  const [stats, setStats] = useState<Stats | null>(null)
  const [top, setTop] = useState<TopNote[]>([])
  const [loading, setLoading] = useState(isAdmin)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false

    async function load() {
      const [statsResult, topResult] = await Promise.all([
        supabase.rpc('admin_stats'),
        supabase
          .from('notes')
          .select('id, title, download_count')
          .eq('status', 'published')
          .order('download_count', { ascending: false })
          .limit(5),
      ])
      if (cancelled) return

      const firstError = statsResult.error ?? topResult.error
      if (firstError) {
        setError(firstError.message)
      } else {
        setStats(statsResult.data as Stats)
        setTop((topResult.data ?? []) as TopNote[])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

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

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link to="/admin/upload" className={linkCard}>
          Upload notes
        </Link>
        {isAdmin && (
          <>
            <Link to="/admin/notes" className={linkCard}>
              Manage notes
            </Link>
            <Link to="/admin/categories" className={linkCard}>
              Manage subjects
            </Link>
          </>
        )}
      </div>

      {!isAdmin && (
        <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
          Contributors can upload notes. An administrator reviews each upload before it
          is published.
        </p>
      )}

      {isAdmin && loading && <p className="mt-8 text-slate-500">Loading statistics...</p>}

      {isAdmin && error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-red-700">
          Could not load statistics: {error}
        </p>
      )}

      {isAdmin && stats && (
        <>
          {stats.pending > 0 && (
            <Link
              to="/admin/notes?status=pending"
              className="mt-6 block rounded-lg bg-amber-50 p-4 font-medium text-amber-800 hover:bg-amber-100"
            >
              {stats.pending} note{stats.pending === 1 ? '' : 's'} waiting for your approval.
              Review now &rarr;
            </Link>
          )}

          <h2 className="mt-8 text-xl font-bold text-slate-800">Statistics</h2>
          <div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total notes" value={stats.total_notes} />
            <StatCard label="Published" value={stats.published} />
            <StatCard label="Pending" value={stats.pending} />
            <StatCard label="Rejected" value={stats.rejected} />
            <StatCard label="Uploads (last 30 days)" value={stats.uploads_last_30_days} />
            <StatCard label="Total downloads" value={stats.total_downloads} />
            <StatCard label="Files stored" value={stats.total_files} />
            <StatCard label="Storage used" value={formatSize(stats.storage_bytes)} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The Supabase free plan includes about 1 GB of file storage.
          </p>

          <h2 className="mt-8 text-xl font-bold text-slate-800">Most downloaded notes</h2>
          {top.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
              No published notes yet.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {top.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <Link
                    to={`/note/${n.id}`}
                    className="min-w-0 break-words font-medium text-sky-800 hover:underline"
                  >
                    {n.title}
                  </Link>
                  <span className="shrink-0 text-sm text-slate-500">
                    {n.download_count} downloads
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}