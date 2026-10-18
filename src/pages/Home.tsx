import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Category, Note } from '../types'
import NoteCard from '../components/NoteCard'

const NOTE_COLUMNS =
  'id, title, description, semester, unit, tags, download_count, created_at, categories(name, slug), note_files(file_type)'

function NoteSection({ title, notes, emptyText }: { title: string; notes: Note[]; emptyText: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      {notes.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [recent, setRecent] = useState<Note[]>([])
  const [popular, setPopular] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [cats, newest, top] = await Promise.all([
        supabase.from('categories').select('id, name, slug').order('name'),
        supabase
          .from('notes')
          .select(NOTE_COLUMNS)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('notes')
          .select(NOTE_COLUMNS)
          .eq('status', 'published')
          .gt('download_count', 0)
          .order('download_count', { ascending: false })
          .limit(6),
      ])

      const firstError = cats.error ?? newest.error ?? top.error
      if (firstError) {
        setError(firstError.message)
      } else {
        setCategories((cats.data ?? []) as Category[])
        setRecent((newest.data ?? []) as unknown as Note[])
        setPopular((top.data ?? []) as unknown as Note[])
      }
      setLoading(false)
    }
    load()
  }, [])

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/library?q=${encodeURIComponent(q)}` : '/library')
  }

  return (
    <div>
      <section className="rounded-2xl bg-sky-700 px-4 py-10 text-center text-white sm:py-14">
        <h1 className="text-3xl font-bold sm:text-4xl">NoteVault</h1>
        <p className="mt-2 text-sky-100">Your Notes, Everyone's Knowledge.</p>
        <form onSubmit={handleSearch} className="mx-auto mt-6 flex max-w-xl gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, subject, topic or tag"
            className="min-w-0 flex-1 rounded-lg px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-sky-300"
          />
          <button
            type="submit"
            className="rounded-lg bg-white px-5 py-3 font-semibold text-sky-800 hover:bg-sky-50"
          >
            Search
          </button>
        </form>
      </section>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
          Could not load data: {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-800">Browse by semester</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <Link
              key={s}
              to={`/library?semester=${s}`}
              className="rounded-full border border-sky-200 bg-white px-4 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-50"
            >
              Semester {s}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-800">Browse by subject</h2>
        {loading ? (
          <p className="mt-3 text-slate-500">Loading subjects...</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/library?subject=${c.slug}`}
                className="break-words rounded-xl border border-slate-200 bg-white p-4 font-medium text-slate-800 shadow-sm hover:border-sky-300 hover:text-sky-800"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <p className="mt-10 text-slate-500">Loading notes...</p>
      ) : (
        <>
          <NoteSection
            title="Recently uploaded"
            notes={recent}
            emptyText="No notes have been published yet. Check back soon!"
          />
          <NoteSection
            title="Popular downloads"
            notes={popular}
            emptyText="No downloads yet. Popular notes will appear here."
          />
        </>
      )}
    </div>
  )
}