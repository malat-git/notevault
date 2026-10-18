import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

interface AdminNote {
  id: string
  title: string
  status: 'pending' | 'published' | 'rejected'
  download_count: number
  created_at: string
  categories: { name: string } | null
  note_files: { id: string }[]
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
]

const badgeClass: Record<string, string> = {
  published: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
}

const smallButton =
  'rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50'

function cleanSearch(text: string) {
  return text.replace(/[,()%*\\"_]/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function ManageNotes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? ''
  const q = searchParams.get('q') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)

  const [notes, setNotes] = useState<AdminNote[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [qInput, setQInput] = useState(q)

  useEffect(() => {
    setQInput(q)
  }, [q])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('notes')
        .select('id, title, status, download_count, created_at, categories(name), note_files(id)', {
          count: 'exact',
        })

      if (status) query = query.eq('status', status)
      const term = cleanSearch(q)
      if (term) query = query.ilike('title', `%${term}%`)

      const from = (page - 1) * PAGE_SIZE
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (cancelled) return
      if (error) {
        setError(error.message)
        setNotes([])
        setTotal(0)
      } else {
        setNotes((data ?? []) as unknown as AdminNote[])
        setTotal(count ?? 0)
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [status, q, page, reloadKey])

  function updateParams(changes: Record<string, string>, keepPage = false) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!keepPage) next.delete('page')
    setSearchParams(next)
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    updateParams({ q: qInput.trim() })
  }

  async function changeStatus(note: AdminNote, newStatus: AdminNote['status'], doneText: string) {
    setBusyId(note.id)
    setMessage(null)
    const { error } = await supabase
      .from('notes')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', note.id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'ok', text: `"${note.title}" ${doneText}.` })
      setReloadKey((k) => k + 1)
    }
    setBusyId(null)
  }

  async function deleteNote(note: AdminNote) {
    const sure = window.confirm(
      `Delete "${note.title}" and all of its files permanently? This cannot be undone.`
    )
    if (!sure) return

    setBusyId(note.id)
    setMessage(null)

    const { data: files, error: filesError } = await supabase
      .from('note_files')
      .select('storage_path')
      .eq('note_id', note.id)
    if (filesError) {
      setMessage({ type: 'error', text: filesError.message })
      setBusyId(null)
      return
    }

    const paths = (files ?? []).map((f) => f.storage_path as string)
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('notes').remove(paths)
      if (removeError) {
        setMessage({ type: 'error', text: `Could not delete the files: ${removeError.message}` })
        setBusyId(null)
        return
      }
    }

    const { error } = await supabase.from('notes').delete().eq('id', note.id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'ok', text: `"${note.title}" was deleted.` })
      setReloadKey((k) => k + 1)
    }
    setBusyId(null)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <Link to="/admin/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Manage notes</h1>

      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search by title"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => updateParams({ status: f.value })}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              status === f.value
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

      <p className="mt-4 text-sm text-slate-600">
        {loading ? 'Loading...' : `${total} note${total === 1 ? '' : 's'}`}
      </p>

      {!loading && !error && notes.length === 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No notes found.
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-900">{n.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {n.categories?.name ?? 'Uncategorised'} · {n.note_files.length} file
                  {n.note_files.length === 1 ? '' : 's'} · {n.download_count} downloads ·{' '}
                  {new Date(n.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass[n.status] ?? ''}`}
              >
                {n.status}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/note/${n.id}`}
                className={`${smallButton} border-slate-300 text-slate-700 hover:bg-slate-100`}
              >
                View
              </Link>
              <Link
                to={`/admin/notes/${n.id}/edit`}
                className={`${smallButton} border-slate-300 text-slate-700 hover:bg-slate-100`}
              >
                Edit
              </Link>
              {n.status !== 'published' && (
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => changeStatus(n, 'published', 'was approved and published')}
                  className={`${smallButton} border-green-600 text-green-700 hover:bg-green-50`}
                >
                  Approve
                </button>
              )}
              {n.status === 'pending' && (
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => changeStatus(n, 'rejected', 'was rejected')}
                  className={`${smallButton} border-amber-600 text-amber-700 hover:bg-amber-50`}
                >
                  Reject
                </button>
              )}
              {n.status === 'published' && (
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => changeStatus(n, 'pending', 'was unpublished')}
                  className={`${smallButton} border-amber-600 text-amber-700 hover:bg-amber-50`}
                >
                  Unpublish
                </button>
              )}
              <button
                type="button"
                disabled={busyId === n.id}
                onClick={() => deleteNote(n)}
                className={`${smallButton} border-red-600 text-red-700 hover:bg-red-50`}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {total > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => updateParams({ page: page - 1 > 1 ? String(page - 1) : '' }, true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => updateParams({ page: String(page + 1) }, true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}