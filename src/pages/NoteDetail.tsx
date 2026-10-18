import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Note, NoteFile, NoteWithFiles } from '../types'
import NoteCard from '../components/NoteCard'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NOTE_COLUMNS =
  'id, title, description, semester, unit, tags, download_count, created_at, category_id, status, categories(name, slug), note_files(id, storage_path, file_name, file_type, file_size)'

const RELATED_COLUMNS =
  'id, title, description, semester, unit, tags, download_count, created_at, categories(name, slug), note_files(file_type)'

const IMAGE_TYPES = ['jpg', 'jpeg', 'png']

function canPreview(file: NoteFile) {
  const t = file.file_type.toLowerCase()
  return t === 'pdf' || IMAGE_TYPES.includes(t)
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>()

  const [note, setNote] = useState<NoteWithFiles | null>(null)
  const [related, setRelated] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [previewFile, setPreviewFile] = useState<NoteFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // Load the note and its related notes
  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setNote(null)
      setRelated([])
      setPreviewFile(null)
      setPreviewUrl(null)

      if (!UUID_PATTERN.test(id as string)) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notes')
        .select(NOTE_COLUMNS)
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      if (!data) {
        setLoading(false)
        return
      }

      const loaded = data as unknown as NoteWithFiles
      setNote(loaded)
      setPreviewFile(loaded.note_files.find(canPreview) ?? null)
      setLoading(false)

      if (loaded.category_id) {
        const rel = await supabase
          .from('notes')
          .select(RELATED_COLUMNS)
          .eq('status', 'published')
          .eq('category_id', loaded.category_id)
          .neq('id', loaded.id)
          .order('download_count', { ascending: false })
          .limit(3)
        if (!cancelled && !rel.error) {
          setRelated((rel.data ?? []) as unknown as Note[])
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  // Get a temporary link for the file being previewed
  useEffect(() => {
    if (!previewFile) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    setPreviewUrl(null)
    setPreviewError(null)

    supabase.storage
      .from('notes')
      .createSignedUrl(previewFile.storage_path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setPreviewError('This file could not be loaded. It may have been removed.')
        } else {
          setPreviewUrl(data.signedUrl)
        }
      })

    return () => {
      cancelled = true
    }
  }, [previewFile])

  async function handleDownload(file: NoteFile) {
    if (!note) return
    setDownloadError(null)
    setDownloadingId(file.id)

    const { data, error } = await supabase.storage
      .from('notes')
      .createSignedUrl(file.storage_path, 60, { download: file.file_name })

    if (error || !data) {
      setDownloadError('Download failed. The file may be missing. Please try again later.')
      setDownloadingId(null)
      return
    }

    const link = document.createElement('a')
    link.href = data.signedUrl
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()

    // Count the download only after the link was created successfully
    const { error: countError } = await supabase.rpc('increment_download', {
      p_note_id: note.id,
    })
    if (!countError) {
      setNote((prev) =>
        prev ? { ...prev, download_count: prev.download_count + 1 } : prev
      )
    }
    setDownloadingId(null)
  }

  if (loading) {
    return <p className="py-10 text-center text-slate-500">Loading note...</p>
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        Could not load this note: {error}
      </div>
    )
  }

  if (!note) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Note not found</h1>
        <p className="mt-2 text-slate-600">
          This note does not exist, or it has been removed.
        </p>
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
  const fileTypes = [...new Set(note.note_files.map((f) => f.file_type.toUpperCase()))]

  return (
    <div>
      <Link to="/library" className="text-sm font-medium text-sky-700 hover:underline">
        &larr; Back to library
      </Link>

      <h1 className="mt-3 break-words text-2xl font-bold text-slate-900 sm:text-3xl">
        {note.title}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {note.categories && (
          <Link
            to={`/library?subject=${note.categories.slug}`}
            className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-800 hover:bg-sky-200"
          >
            {note.categories.name}
          </Link>
        )}
        {note.semester && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Semester {note.semester}
          </span>
        )}
        {note.unit && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {note.unit}
          </span>
        )}
        {fileTypes.map((t) => (
          <span key={t} className="rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-700">
            {t}
          </span>
        ))}
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Uploaded on {uploaded} · {note.download_count} download
        {note.download_count === 1 ? '' : 's'}
      </p>

      {note.description && (
        <p className="mt-4 whitespace-pre-line break-words text-slate-700">
          {note.description}
        </p>
      )}

      {note.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {note.tags.map((tag) => (
            <Link
              key={tag}
              to={`/library?q=${encodeURIComponent(tag)}`}
              className="text-sm text-sky-700 hover:underline"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-800">Files</h2>
        {note.note_files.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            No files are attached to this note.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {note.note_files.map((file) => (
              <li
                key={file.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-800">{file.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {file.file_type.toUpperCase()} · {formatSize(file.file_size)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canPreview(file) && (
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Preview
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    disabled={downloadingId === file.id}
                    className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
                  >
                    {downloadingId === file.id ? 'Preparing...' : 'Download'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {downloadError && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{downloadError}</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-800">Preview</h2>
        {!previewFile ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            Preview is available for PDF and image files. Use the Download button to
            open other file types.
          </p>
        ) : previewError ? (
          <p className="mt-3 rounded-lg bg-red-50 p-4 text-red-700">{previewError}</p>
        ) : !previewUrl ? (
          <p className="mt-3 text-slate-500">Loading preview...</p>
        ) : (
          <div className="mt-3">
            {previewFile.file_type.toLowerCase() === 'pdf' ? (
              <iframe
                src={previewUrl}
                title={`Preview of ${previewFile.file_name}`}
                className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white"
              />
            ) : (
              <img
                src={previewUrl}
                alt={previewFile.file_name}
                className="mx-auto max-h-[70vh] max-w-full rounded-xl border border-slate-200 bg-white"
              />
            )}
            <p className="mt-2 text-sm text-slate-500">
              Preview not showing on your phone?{' '}
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-700 hover:underline"
              >
                Open in a new tab
              </a>{' '}
              or use the Download button.
            </p>
          </div>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-800">Related notes</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}