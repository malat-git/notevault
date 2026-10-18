import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ReportLink from '../components/ReportLink'

// Change these two only if Step 72-1 showed different names.
const COUNTER_FUNCTION = 'increment_download'
const COUNTER_ARGUMENT = 'note_id'

const BUCKET = 'notes'

type FileRow = Record<string, unknown> & { id: string; storage_path: string }

interface Note {
  id: string
  title: string
  description: string | null
  semester: number | null
  unit: string | null
  tags: string[] | null
  download_count: number
  created_at: string
  category_id: number | null
  categories: { name: string } | null
  note_files: FileRow[]
}

interface RelatedNote {
  id: string
  title: string
  download_count: number
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

function fileName(f: FileRow) {
  return (
    pick(f, ['file_name', 'original_name', 'filename', 'name']) ||
    f.storage_path.split('/').pop() ||
    'file'
  )
}

function fileExtension(f: FileRow) {
  const name = fileName(f)
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function formatSize(bytes: unknown) {
  const n = typeof bytes === 'number' ? bytes : 0
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>()

  const [note, setNote] = useState<Note | null>(null)
  const [related, setRelated] = useState<RelatedNote[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setNotFound(false)
      setLoadError(null)
      setPreviewId(null)
      setPreviewUrl(null)
      setPreviewError(null)
      setDownloadError(null)

      const { data, error } = await supabase
        .from('notes')
        .select(
          'id, title, description, semester, unit, tags, download_count, created_at, category_id, categories(name), note_files(*)'
        )
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setLoadError(error.message)
        setNote(null)
        setLoading(false)
        return
      }
      if (!data) {
        setNotFound(true)
        setNote(null)
        setLoading(false)
        return
      }

      const loaded = data as unknown as Note
      setNote(loaded)
      setLoading(false)

      if (loaded.category_id) {
        const rel = await supabase
          .from('notes')
          .select('id, title, download_count')
          .eq('status', 'published')
          .eq('category_id', loaded.category_id)
          .neq('id', loaded.id)
          .order('download_count', { ascending: false })
          .limit(4)
        if (!cancelled && !rel.error) {
          setRelated((rel.data ?? []) as RelatedNote[])
        }
      } else {
        setRelated([])
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function togglePreview(f: FileRow) {
    if (previewId === f.id) {
      setPreviewId(null)
      setPreviewUrl(null)
      setPreviewError(null)
      return
    }
    setPreviewId(f.id)
    setPreviewUrl(null)
    setPreviewError(null)

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, 3600)

    if (error || !data) {
      setPreviewError(error?.message ?? 'Could not create the preview.')
    } else {
      setPreviewUrl(data.signedUrl)
    }
  }

  async function handleDownload(f: FileRow) {
    if (!note) return
    setDownloadingId(f.id)
    setDownloadError(null)

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, 60, { download: fileName(f) })

    if (error || !data) {
      setDownloadError(error?.message ?? 'Could not start the download.')
      setDownloadingId(null)
      return
    }

    const counter = await supabase.rpc(COUNTER_FUNCTION, {
      [COUNTER_ARGUMENT]: note.id,
    })
    if (counter.error) {
      console.warn('Download counter failed:', counter.error.message)
    } else {
      setNote((n) => (n ? { ...n, download_count: n.download_count + 1 } : n))
    }

    window.location.href = data.signedUrl
    setDownloadingId(null)
  }

  if (loading) {
    return <p className="py-16 text-center text-slate-500">Loading...</p>
  }

  if (loadError) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-red-700">Could not load this note: {loadError}</p>
    )
  }

  if (notFound || !note) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Note not found</h1>
        <p className="mt-2 text-slate-600">This note does not exist, or it has been removed.</p>
        <Link
          to="/library"
          className="mt-6 inline-block rounded-lg bg-sky-700 px-4 py-2 text-white hover:bg-sky-800"
        >
          Browse the library
        </Link>
      </div>
    )
  }

  const uploaded = new Date(note.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const fileTypes = [...new Set(note.note_files.map((f) => fileExtension(f).toUpperCase()))]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/library" className="text-sm font-medium text-sky-700 hover:underline">
        &larr; Back to the library
      </Link>

      <h1 className="mt-3 break-words text-3xl font-bold text-slate-900">{note.title}</h1>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {note.categories && (
          <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-800">
            {note.categories.name}
          </span>
        )}
        {note.semester && (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                        Year {note.semester}
          </span>
        )}
        {note.unit && (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">{note.unit}</span>
        )}
        {fileTypes && (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">{fileTypes}</span>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Uploaded {uploaded} · {note.download_count} download{note.download_count === 1 ? '' : 's'}
      </p>

      {note.description && (
        <p className="mt-5 whitespace-pre-wrap break-words text-slate-700">{note.description}</p>
      )}

      {note.tags && note.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {note.tags.map((t) => (
            <Link
              key={t}
              to={`/library?q=${encodeURIComponent(t)}`}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-xl font-bold text-slate-800">Files</h2>

      {downloadError && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{downloadError}</p>
      )}

      {note.note_files.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          This note has no files.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {note.note_files.map((f) => {
            const isPdf = fileExtension(f) === 'pdf'
            const open = previewId === f.id
            return (
              <li key={f.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-900">{fileName(f)}</p>
                    <p className="text-xs text-slate-500">
                      {fileExtension(f).toUpperCase()} · {formatSize(f.file_size)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isPdf && (
                      <button
                        type="button"
                        onClick={() => togglePreview(f)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {open ? 'Hide preview' : 'Preview'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={downloadingId === f.id}
                      onClick={() => handleDownload(f)}
                      className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
                    >
                      {downloadingId === f.id ? 'Preparing...' : 'Download'}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-4">
                    {previewError && (
                      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{previewError}</p>
                    )}
                    {!previewError && !previewUrl && (
                      <p className="text-sm text-slate-500">Loading preview...</p>
                    )}
                    {previewUrl && (
                      <iframe
                        src={previewUrl}
                        title={`Preview of ${fileName(f)}`}
                        className="h-[70vh] w-full rounded-lg border border-slate-200"
                      />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {related.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold text-slate-800">Related notes</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/note/${r.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-300 hover:bg-sky-50"
                >
                  <p className="break-words font-medium text-sky-800">{r.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{r.download_count} downloads</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <ReportLink />
    </div>
  )
}