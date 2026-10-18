import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Category } from '../types'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const inputClass =
  'min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200'

export default function ManageCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('categories')
      .select('id, name, slug')
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setMessage({ type: 'error', text: error.message })
        else setCategories((data ?? []) as Category[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const name = newName.trim()
    const slug = slugify(name)
    if (name.length < 2 || !slug) {
      setMessage({ type: 'error', text: 'Please enter a subject name using letters or numbers.' })
      return
    }
    setBusy(true)
    const { error } = await supabase.from('categories').insert({ name, slug })
    if (error) {
      setMessage({
        type: 'error',
        text: error.code === '23505' ? 'A subject with this name already exists.' : error.message,
      })
    } else {
      setMessage({ type: 'ok', text: `"${name}" was added.` })
      setNewName('')
      setReloadKey((k) => k + 1)
    }
    setBusy(false)
  }

  async function handleRename(id: number) {
    setMessage(null)
    const name = editName.trim()
    if (name.length < 2) {
      setMessage({ type: 'error', text: 'The name must be at least 2 characters.' })
      return
    }
    setBusy(true)
    const { error } = await supabase.from('categories').update({ name }).eq('id', id)
    if (error) {
      setMessage({
        type: 'error',
        text: error.code === '23505' ? 'A subject with this name already exists.' : error.message,
      })
    } else {
      setMessage({ type: 'ok', text: 'Subject renamed.' })
      setEditingId(null)
      setReloadKey((k) => k + 1)
    }
    setBusy(false)
  }

  async function handleDelete(c: Category) {
    const sure = window.confirm(
      `Delete the subject "${c.name}"? Notes in this subject will not be deleted, but they will become uncategorised.`
    )
    if (!sure) return
    setMessage(null)
    setBusy(true)
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'ok', text: `"${c.name}" was deleted.` })
      setReloadKey((k) => k + 1)
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/admin/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Manage subjects</h1>

      <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New subject name"
          maxLength={100}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          Add subject
        </button>
      </form>

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

      {loading ? (
        <p className="mt-6 text-slate-500">Loading...</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              {editingId === c.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={100}
                    className={inputClass}
                    aria-label="Subject name"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRename(c.id)}
                      className="rounded-lg bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="min-w-0 break-words font-medium text-slate-800">{c.name}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id)
                        setEditName(c.name)
                        setMessage(null)
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(c)}
                      className="rounded-lg border border-red-600 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}