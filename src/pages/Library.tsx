import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Category, Note } from '../types'
import NoteCard from '../components/NoteCard'

const PAGE_SIZE = 12

const YEARS = [1, 2, 3, 4]

const FILE_TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF', extensions: ['pdf'] },
  { value: 'ppt', label: 'PPT / PPTX', extensions: ['ppt', 'pptx'] },
  { value: 'doc', label: 'DOC / DOCX', extensions: ['doc', 'docx'] },
  { value: 'txt', label: 'TXT', extensions: ['txt'] },
  { value: 'image', label: 'Images (JPG / PNG)', extensions: ['jpg', 'jpeg', 'png'] },
]

const NOTE_FIELDS =
  'id, title, description, semester, unit, tags, download_count, created_at'

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200'

// Remove characters that could break the search query
function cleanSearch(text: string) {
  return text.replace(/[,()%*\\"_]/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const subject = searchParams.get('subject') ?? ''
  const semester = searchParams.get('semester') ?? ''
  const unit = searchParams.get('unit') ?? ''
  const type = searchParams.get('type') ?? ''
  const sort = searchParams.get('sort') ?? 'newest'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qInput, setQInput] = useState(q)
  const [unitInput, setUnitInput] = useState(unit)

  // Keep the text boxes in sync with the web address
  useEffect(() => {
    setQInput(q)
    setUnitInput(unit)
  }, [q, unit])

  // Load the subjects once
  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, slug')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setCategories((data ?? []) as Category[])
        setCategoriesLoaded(true)
      })
  }, [])

  // Load the notes whenever a filter, the sort order or the page changes
  useEffect(() => {
    if (!categoriesLoaded) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const select = `${NOTE_FIELDS}, categories${subject ? '!inner' : ''}(name, slug), note_files${type ? '!inner' : ''}(file_type)`

      let query = supabase
        .from('notes')
        .select(select, { count: 'exact' })
        .eq('status', 'published')

      if (subject) query = query.eq('categories.slug', subject)
      if (semester) query = query.eq('semester', Number(semester))
      if (unit) query = query.ilike('unit', `%${cleanSearch(unit)}%`)

      if (type) {
        const option = FILE_TYPE_OPTIONS.find((o) => o.value === type)
        if (option) query = query.in('note_files.file_type', option.extensions)
      }

      const term = cleanSearch(q)
      if (term) {
        const matchingIds = categories
          .filter((c) => c.name.toLowerCase().includes(term.toLowerCase()))
          .map((c) => c.id)
        const parts = [
          `title.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `unit.ilike.%${term}%`,
          `tags.cs.{"${term.toLowerCase()}"}`,
        ]
        if (matchingIds.length > 0) {
          parts.push(`category_id.in.(${matchingIds.join(',')})`)
        }
        query = query.or(parts.join(','))
      }

      if (sort === 'alpha') {
        query = query.order('title', { ascending: true })
      } else if (sort === 'popular') {
        query = query
          .order('download_count', { ascending: false })
          .order('created_at', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const from = (page - 1) * PAGE_SIZE
      const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)

      if (cancelled) return
      if (error) {
        setError(error.message)
        setNotes([])
        setTotal(0)
      } else {
        setNotes((data ?? []) as unknown as Note[])
        setTotal(count ?? 0)
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [categoriesLoaded, categories, q, subject, semester, unit, type, sort, page])

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
    updateParams({ q: qInput.trim(), unit: unitInput.trim() })
  }

  function goToPage(p: number) {
    updateParams({ page: p > 1 ? String(p) : '' }, true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Boolean(q || subject || semester || unit || type || sort !== 'newest')

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Notes Library</h1>
      <p className="mt-1 text-slate-600">
        Search and download notes shared by students and teachers.
      </p>

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search by title, subject, topic or tag"
          className={`${fieldClass} sm:flex-1`}
        />
        <input
          type="text"
          value={unitInput}
          onChange={(e) => setUnitInput(e.target.value)}
          placeholder="Unit (e.g. Unit 2)"
          className={`${fieldClass} sm:w-48`}
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          Search
        </button>
      </form>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={subject}
          onChange={(e) => updateParams({ subject: e.target.value })}
          className={fieldClass}
          aria-label="Filter by subject"
        >
          <option value="">All subjects</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={semester}
          onChange={(e) => updateParams({ semester: e.target.value })}
          className={fieldClass}
          aria-label="Filter by year"
        >
          <option value="">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => updateParams({ type: e.target.value })}
          className={fieldClass}
          aria-label="Filter by file type"
        >
          <option value="">All file types</option>
          {FILE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) =>
            updateParams({ sort: e.target.value === 'newest' ? '' : e.target.value })
          }
          className={fieldClass}
          aria-label="Sort notes"
        >
          <option value="newest">Newest first</option>
          <option value="alpha">A to Z</option>
          <option value="popular">Most downloaded</option>
        </select>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>{loading ? 'Loading...' : `${total} note${total === 1 ? '' : 's'} found`}</span>
        {hasFilters && (
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="font-medium text-sky-700 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
          <p>Could not load notes: {error}</p>
          {page > 1 && (
            <button
              type="button"
              onClick={() => goToPage(1)}
              className="mt-2 font-medium underline"
            >
              Go to page 1
            </button>
          )}
        </div>
      )}

      {!loading && !error && notes.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          {hasFilters
            ? 'No notes match your search. Try different words or clear the filters.'
            : 'No notes have been published yet. Check back soon!'}
        </p>
      )}

      {notes.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => goToPage(page + 1)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}