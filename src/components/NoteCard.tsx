import { Link } from 'react-router-dom'
import type { Note } from '../types'

export default function NoteCard({ note }: { note: Note }) {
  const fileTypes = [
    ...new Set(note.note_files.map((f) => f.file_type.toUpperCase())),
  ]
  const date = new Date(note.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <Link
      to={`/note/${note.id}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md"
    >
      <h3 className="break-words text-base font-semibold text-slate-900">
        {note.title}
      </h3>
      <p className="mt-1 text-sm text-sky-700">
        {note.categories?.name ?? 'Uncategorised'}
        {note.semester ? ` · Semester ${note.semester}` : ''}
      </p>
      {note.description && (
        <p className="mt-2 line-clamp-2 break-words text-sm text-slate-600">
          {note.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {fileTypes.map((t) => (
          <span key={t} className="rounded bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
            {t}
          </span>
        ))}
        <span>{note.download_count} downloads</span>
        <span>{date}</span>
      </div>
    </Link>
  )
}