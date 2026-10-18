import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface Report {
  id: string
  note_id: string | null
  reason: string
  details: string | null
  reporter_email: string | null
  status: 'open' | 'resolved' | 'dismissed'
  created_at: string
  notes: { id: string; title: string; status: string } | null
}

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: '', label: 'All' },
]

const badgeClass: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  dismissed: 'bg-slate-200 text-slate-700',
}

const smallButton = 'rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50'

export default function ManageReports() {
  const [filter, setFilter] = useState('open')
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('reports')
        .select('id, note_id, reason, details, reporter_email, status, created_at, notes(id, title, status)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (filter) query = query.eq('status', filter)

      const { data, error } = await query
      if (cancelled) return
      if (error) {
        setError(error.message)
        setReports([])
      } else {
        setReports((data ?? []) as unknown as Report[])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [filter, reloadKey])

  async function setReportStatus(r: Report, status: 'resolved' | 'dismissed') {
    setBusyId(r.id)
    setMessage(null)
    const { error } = await supabase.from('reports').update({ status }).eq('id', r.id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'ok', text: `Report marked as ${status}.` })
      setReloadKey((k) => k + 1)
    }
    setBusyId(null)
  }

  async function takeDown(r: Report) {
    if (!r.note_id || !r.notes) return
    const sure = window.confirm(
      `Take down "${r.notes.title}"? It will be hidden from the public and all open reports about it will be resolved.`
    )
    if (!sure) return

    setBusyId(r.id)
    setMessage(null)

    const noteResult = await supabase
      .from('notes')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', r.note_id)
    if (noteResult.error) {
      setMessage({ type: 'error', text: noteResult.error.message })
      setBusyId(null)
      return
    }

    const reportResult = await supabase
      .from('reports')
      .update({ status: 'resolved' })
      .eq('note_id', r.note_id)
      .eq('status', 'open')
    if (reportResult.error) {
      setMessage({ type: 'error', text: reportResult.error.message })
    } else {
      setMessage({ type: 'ok', text: `"${r.notes.title}" was taken down.` })
      setReloadKey((k) => k + 1)
    }
    setBusyId(null)
  }

  async function deleteReport(r: Report) {
    if (!window.confirm('Delete this report permanently?')) return
    setBusyId(r.id)
    setMessage(null)
    const { error } = await supabase.from('reports').delete().eq('id', r.id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'ok', text: 'Report deleted.' })
      setReloadKey((k) => k + 1)
    }
    setBusyId(null)
  }

  return (
    <div>
      <Link to="/admin/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Reports</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              filter === f.value
                ? 'border-sky-700 bg-sky-700 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {message && (
        <p
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
          role="status"
        >
          {message.text}
        </p>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading && <p className="mt-4 text-sm text-slate-500">Loading...</p>}

      {!loading && !error && reports.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No reports here.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {reports.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-900">
                  {r.notes ? r.notes.title : 'Note no longer exists'}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-700">{r.reason}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass[r.status] ?? ''}`}
              >
                {r.status}
              </span>
            </div>

            {r.details && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
                {r.details}
              </p>
            )}

            <p className="mt-2 text-xs text-slate-500">
              {new Date(r.created_at).toLocaleString('en-IN')}
              {r.reporter_email && <> · reply to {r.reporter_email}</>}
              {r.notes && <> · note is currently {r.notes.status}</>}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {r.note_id && (
                <Link
                  to={`/note/${r.note_id}`}
                  className={`${smallButton} border-slate-300 text-slate-700 hover:bg-slate-100`}
                >
                  View note
                </Link>
              )}
              {r.status === 'open' && r.notes && r.notes.status === 'published' && (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => takeDown(r)}
                  className={`${smallButton} border-red-600 text-red-700 hover:bg-red-50`}
                >
                  Take down note
                </button>
              )}
              {r.status === 'open' && (
                <>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => setReportStatus(r, 'resolved')}
                    className={`${smallButton} border-green-600 text-green-700 hover:bg-green-50`}
                  >
                    Mark resolved
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => setReportStatus(r, 'dismissed')}
                    className={`${smallButton} border-slate-300 text-slate-700 hover:bg-slate-100`}
                  >
                    Dismiss
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => deleteReport(r)}
                className={`${smallButton} border-slate-300 text-slate-500 hover:bg-slate-100`}
              >
                Delete report
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}