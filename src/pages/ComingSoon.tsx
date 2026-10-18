import { Link } from 'react-router-dom'

export default function ComingSoon() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold text-slate-800">This page is coming soon</h1>
      <p className="mt-2 text-slate-600">We are building it in a later phase.</p>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-sky-700 px-4 py-2 text-white hover:bg-sky-800">
        Back to Home
      </Link>
    </div>
  )
}