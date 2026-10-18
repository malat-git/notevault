import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import type { Category } from '../types'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 10
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const YEARS = [1, 2, 3, 4]

// Allowed file extensions and their official file types
const ALLOWED: Record<string, string> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}
const ALLOWED_EXTENSIONS = Object.keys(ALLOWED)

type ItemStatus = 'ready' | 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  ext: string
  progress: number
  status: ItemStatus
  error?: string
}

const labelClass = 'block text-sm font-medium text-slate-700'
const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(item: UploadItem) {
  if (item.status === 'uploading') return `Uploading ${item.progress}%`
  if (item.status === 'done') return 'Uploaded'
  if (item.status === 'error') return 'Failed'
  return 'Ready'
}

function parseTags(text: string) {
  const tags = text
    .split(',')
    .map((t) => t.replace(/["{}\\]/g, '').trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 30)
  return [...new Set(tags)].slice(0, 10)
}

// Check the first bytes of the file to make sure it really is what its name says
async function looksValid(file: File, ext: string) {
  if (ext === 'txt') return true
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b)
  if (ext === 'pdf') return startsWith([0x25, 0x50, 0x44, 0x46])
  if (ext === 'png') return startsWith([0x89, 0x50, 0x4e, 0x47])
  if (ext === 'jpg' || ext === 'jpeg') return startsWith([0xff, 0xd8, 0xff])
  if (ext === 'docx' || ext === 'pptx') return startsWith([0x50, 0x4b])
  if (ext === 'doc' || ext === 'ppt') return startsWith([0xd0, 0xcf, 0x11, 0xe0])
  return false
}

// A fingerprint of the file, used to detect duplicates
async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Upload one file to Supabase Storage and report progress
function uploadWithProgress(
  path: string,
  file: File,
  ext: string,
  accessToken: string,
  onProgress: (percent: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const body = new FormData()
    body.append('cacheControl', '3600')
    body.append('', file.slice(0, file.size, ALLOWED[ext]))

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/notes/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('apikey', SUPABASE_KEY)
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      let message = `Upload failed (error ${xhr.status}).`
      try {
        const parsed = JSON.parse(xhr.responseText)
        if (parsed.message) message = parsed.message
      } catch {
        // keep the default message
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('Network error while uploading.'))
    xhr.send(body)
  })
}

export default function UploadPage() {
  const { session, role } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [year, setYear] = useState('')
  const [unit, setUnit] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [items, setItems] = useState<UploadItem[]>([])
  const [fileMessages, setFileMessages] = useState<string[]>([])
  const [publishNow, setPublishNow] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ noteId: string; published: boolean } | null>(null)

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, slug')
      .order('name')
      .then(({ data }) => setCategories((data ?? []) as Category[]))
  }, [])

  function patchItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? [])
    e.target.value = ''

    const problems: string[] = []
    const added: UploadItem[] = []

    for (const file of chosen) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const id = `${file.name}-${file.size}-${file.lastModified}`

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        problems.push(`${file.name}: this file type is not allowed.`)
        continue
      }
      if (file.size === 0) {
        problems.push(`${file.name}: the file is empty.`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        problems.push(`${file.name}: larger than 10 MB (${formatSize(file.size)}).`)
        continue
      }
      if (items.some((i) => i.id === id) || added.some((i) => i.id === id)) {
        problems.push(`${file.name}: already added.`)
        continue
      }
      if (items.length + added.length >= MAX_FILES) {
        problems.push(`Only ${MAX_FILES} files can be added to one note.`)
        break
      }
      if (!(await looksValid(file, ext))) {
        problems.push(`${file.name}: does not look like a real .${ext} file.`)
        continue
      }
      added.push({ id, file, ext, progress: 0, status: 'ready' })
    }

    setItems((prev) => [...prev, ...added])
    setFileMessages(problems)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSuccess(null)
    if (!session) return

    const cleanTitle = title.trim()
    if (cleanTitle.length < 3 || cleanTitle.length > 200) {
      setFormError('The title must be between 3 and 200 characters.')
      return
    }
    if (items.length === 0) {
      setFormError('Please choose at least one file.')
      return
    }
    if (!agreed) {
      setFormError('Please confirm that you have the right to share these files.')
      return
    }

    setSubmitting(true)
    const uploadedPaths: string[] = []
    let noteId: string | null = null

    try {
      // 1. Check for duplicates
      const hashes = await Promise.all(items.map((i) => sha256Hex(i.file)))
      if (new Set(hashes).size !== hashes.length) {
        throw new Error('You selected the same file more than once.')
      }
      const dup = await supabase
        .from('note_files')
        .select('file_name')
        .in('file_hash', hashes)
      if (dup.error) throw new Error(dup.error.message)
      if (dup.data && dup.data.length > 0) {
        throw new Error(
          `These files were already uploaded: ${dup.data.map((d) => d.file_name).join(', ')}`
        )
      }

      // 2. Create the note (always starts as pending)
      const { data: noteRow, error: noteError } = await supabase
        .from('notes')
        .insert({
          title: cleanTitle,
          description: description.trim() || null,
          category_id: categoryId ? Number(categoryId) : null,
          semester: year ? Number(year) : null,
          unit: unit.trim() || null,
          tags: parseTags(tagsText),
          status: 'pending',
          uploaded_by: session.user.id,
        })
        .select('id')
        .single()
      if (noteError || !noteRow) {
        throw new Error(noteError?.message ?? 'Could not create the note.')
      }
      noteId = noteRow.id as string

      // 3. Upload each file, then save its details
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        patchItem(item.id, { status: 'uploading', progress: 0, error: undefined })
        const path = `${noteId}/${crypto.randomUUID()}.${item.ext}`
        try {
          await uploadWithProgress(path, item.file, item.ext, session.access_token, (pct) =>
            patchItem(item.id, { progress: pct })
          )
          uploadedPaths.push(path)

          const { error: fileError } = await supabase.from('note_files').insert({
            note_id: noteId,
            storage_path: path,
            file_name: item.file.name,
            file_type: item.ext,
            file_size: item.file.size,
            file_hash: hashes[i],
          })
          if (fileError) {
            throw new Error(
              fileError.code === '23505'
                ? 'This file has already been uploaded by someone else.'
                : fileError.message
            )
          }
          patchItem(item.id, { status: 'done', progress: 100 })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed.'
          patchItem(item.id, { status: 'error', error: msg })
          throw err
        }
      }

      // 4. Admins can publish straight away
      const publish = role === 'admin' && publishNow
      if (publish) {
        const { error: publishError } = await supabase
          .from('notes')
          .update({ status: 'published' })
          .eq('id', noteId)
        if (publishError) throw new Error(publishError.message)
      }

      setSuccess({ noteId, published: publish })
      setTitle('')
      setDescription('')
      setCategoryId('')
      setYear('')
      setUnit('')
      setTagsText('')
      setItems([])
      setFileMessages([])
      setAgreed(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.'
      let extra = ''
      if (noteId) {
        if (role === 'admin') {
          // Admins can clean up the incomplete upload
          if (uploadedPaths.length > 0) {
            await supabase.storage.from('notes').remove(uploadedPaths)
          }
          await supabase.from('notes').delete().eq('id', noteId)
          setItems((prev) =>
            prev.map((i) => (i.status === 'done' ? { ...i, status: 'ready', progress: 0 } : i))
          )
          extra = ' The incomplete upload was removed. Please try again.'
        } else {
          extra =
            ' Your submission was saved as pending but is incomplete. Please ask an administrator to remove it, then try again.'
        }
      }
      setFormError(message + extra)
    } finally {
      setSubmitting(false)
    }
  }

  const overall =
    items.length > 0
      ? Math.round(items.reduce((sum, i) => sum + i.progress, 0) / items.length)
      : 0

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/admin/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Upload notes</h1>
      <p className="mt-1 text-sm text-slate-600">
        {role === 'admin'
          ? 'As an administrator, you can publish your upload immediately.'
          : 'Your upload will be reviewed by an administrator before it appears publicly.'}
      </p>

      {success && (
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-green-800" role="status">
          {success.published ? (
            <>
              Note published successfully.{' '}
              <Link to={`/note/${success.noteId}`} className="font-medium underline">
                View it
              </Link>
              .
            </>
          ) : (
            'Note submitted. It will appear publicly after an administrator approves it.'
          )}
        </div>
      )}
      {formError && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
          {formError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <fieldset disabled={submitting} className="space-y-5">
          <div>
            <label htmlFor="title" className={labelClass}>
              Title *
            </label>
            <input
              id="title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="subject" className={labelClass}>
                Subject
              </label>
              <select
                id="subject"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={fieldClass}
              >
                <option value="">Choose a subject</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="year" className={labelClass}>
                Year
              </label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={fieldClass}
              >
                <option value="">Not specified</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="unit" className={labelClass}>
                Unit
              </label>
              <input
                id="unit"
                type="text"
                maxLength={50}
                placeholder="e.g. Unit 2"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="tags" className={labelClass}>
              Tags (separate with commas)
            </label>
            <input
              id="tags"
              type="text"
              placeholder="e.g. sql, normalization, joins"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="files" className={labelClass}>
              Files * (PDF, PPT, PPTX, DOC, DOCX, TXT, JPG, PNG, up to 10 MB each, max {MAX_FILES}{' '}
              files)
            </label>
            <input
              id="files"
              type="file"
              multiple
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-sky-700 hover:file:bg-sky-100"
            />
            {fileMessages.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {fileMessages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-800">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.ext.toUpperCase()} · {formatSize(item.file.size)} ·{' '}
                        {statusLabel(item)}
                      </p>
                    </div>
                    {!submitting && item.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {(item.status === 'uploading' || item.status === 'done') && (
                    <div
                      className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-200"
                      role="progressbar"
                      aria-valuenow={item.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-sky-600 transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.error && <p className="mt-1 text-xs text-red-600">{item.error}</p>}
                </li>
              ))}
            </ul>
          )}

          {submitting && items.length > 0 && (
            <p className="text-sm text-slate-600">Overall progress: {overall}%</p>
          )}

          {role === 'admin' && (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(e) => setPublishNow(e.target.checked)}
                className="mt-0.5"
              />
              <span>Publish immediately (otherwise it stays pending until you approve it)</span>
            </label>
          )}

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have the right to share these files, and they do not contain private
              personal information such as phone numbers, addresses or ID numbers.
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:opacity-60 sm:w-auto"
          >
            {submitting ? 'Uploading...' : 'Upload'}
          </button>
        </fieldset>
      </form>
    </div>
  )
}