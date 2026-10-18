import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Category } from '../types'

const labelClass = 'block text-sm font-medium text-slate-700'
const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200'

const YEARS = [1, 2, 3, 4]

function parseTags(text: string) {
  const tags = text
    .split(',')
    .map((t) => t.replace(/["{}\\]/g, '').trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 30)
  return [...new Set(tags)].slice(0, 10)
}

export default function EditNote() {
  const { id } = useParams<{ id: string }>()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [year, setYear] = useState('')
  const [unit, setUnit] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [status, setStatus] = useState('pending')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      const [cats, noteResult] = await Promise.all([
        supabase.from('categories').select('id, name, slug').order('name'),
        supabase
          .from('notes')
          .select('id, title, description, category_id, semester, unit, tags, status')
          .eq('id', id)
          .maybeSingle(),
      ])
      if (cancelled) return

      if (cats.error || noteResult.error) {
        setLoadError((cats.error ?? noteResult.error)!.message)
      } else if (!noteResult.data) {
        setNotFound(true)
      } else {
        const n = noteResult.data
        setCategories((cats.data ?? []) as Category[])
        setTitle(n.title as string)
        setDescription((n.description as string | null) ?? '')
        setCategoryId(n.category_id ? String(n.category_id) : '')
        setYear(n.semester ? String(n.semester) : '')
        setUnit((n.unit as string | null) ?? '')
        setTagsText(((n.tags as string[] | null) ?? []).join(', '))
        setStatus(n.status as string)
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    const cleanTitle = title.trim()
    if (cleanTitle.length < 3 || cleanTitle.length > 200) {
      setMessage({ type: 'error', text: 'The title must be between 3 and 200 characters.' })
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('notes')
      .update({
        title: cleanTitle,
        description: description.trim() || null,
        category_id: categoryId ? Number(categoryId) : null,
        semester: year ? Number(year) : null,
        unit: unit.trim() || null,
        tags: parseTags(tagsText),
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'ok', text: 'Changes saved.' })
    }
    setSaving(false)
  }

  if (loading) return <p className="py-10 text-center text-slate-500">Loading...</p>
  if (loadError) {
    return <p className="rounded-lg bg-red-50 p-4 text-red-700">Could not load: {loadError}</p>
  }
  if (notFound) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Note not found</h1>
        <Link to="/admin/notes" className="mt-4 inline-block text-sky-700 hover:underline">
          Back to Manage notes
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/admin/notes" className="text-sm font-medium text-sky-700 hover:underline">
        &larr; Back to Manage notes
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Edit note</h1>

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

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <fieldset disabled={saving} className="space-y-5">
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
              rows={4}
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
                <option value="">No subject</option>
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
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={fieldClass}
            >
              <option value="pending">Pending (hidden from the public)</option>
              <option value="published">Published (visible to everyone)</option>
              <option value="rejected">Rejected (hidden from the public)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:opacity-60 sm:w-auto"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </fieldset>
      </form>
    </div>
  )
}