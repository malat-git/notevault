import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const REASONS = [
  'Copyright / takedown request',
  'Inappropriate content',
  'Wrong or misleading content',
  'Spam',
  'Other',
]

const labelClass = 'block text-sm font-medium text-slate-700'
const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200'

export default function ReportPage() {
  const { id } = useParams<{ id: string }>()

  const [noteTitle, setNoteTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from('notes')
      .select('title')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setNoteTitle(data ? (data.title as string) : null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (reason === 'Other' && details.trim().length < 5) {
      setError('Please describe the problem in the details box.')
      return
    }

    setSending(true)
    const { error } = await supabase.from('reports').insert({
      note_id: id,
      reason,
      details: details.trim() || null,
      reporter_email: email.trim() || null,
      status: 'open',
    })
    setSending(false)

    if (error) {
      setError('Could not send your report. The note may have been removed. ' + error.message)
    } else {
      setDone(true)
    }
  }

  if (loading) return <p className="py-10 text-center text-slate-500">Loading...</p>

  if (!noteTitle) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Note not found</h1>
        <Link to="/library" className="mt-4 inline-block text-sky-700 hover:underline">
          Back to the library
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Thank you</h1>
        <p className="mt-3 text-slate-600">
          Your report was sent. An administrator will review it soon.
        </p>
        <Link to="/library" className="mt-6 inline-block text-sky-700 hover:underline">
          Back to the library
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link to={`/note/${id}`} className="text-sm font-medium text-sky-700 hover:underline">
        &larr; Back to the note
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Report a note</h1>
      <p className="mt-1 break-words text-sm text-slate-600">
        Reporting: <span className="font-medium">{noteTitle}</span>
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <fieldset disabled={sending} className="space-y-5">
          <div>
            <label htmlFor="reason" className={labelClass}>
              Reason *
            </label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={fieldClass}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="details" className={labelClass}>
              Details
            </label>
            <textarea
              id="details"
              rows={5}
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain the problem. For copyright, say who owns the work."
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Your email (optional, so we can reply)
            </label>
            <input
              id="email"
              type="email"
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:opacity-60 sm:w-auto"
          >
            {sending ? 'Sending...' : 'Send report'}
          </button>
        </fieldset>
      </form>
    </div>
  )
}