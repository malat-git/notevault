import { Link, useParams } from 'react-router-dom'

export default function ReportLink() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null

  return (
    <p className="mt-10 border-t border-slate-200 pt-4 text-sm text-slate-500">
      Something wrong with this note, or it is your copyrighted work?{' '}
      <Link to={`/report/${id}`} className="font-medium text-sky-700 hover:underline">
        Report this note
      </Link>
    </p>
  )
}