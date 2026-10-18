import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Library from './pages/Library'
import NoteDetail from './pages/NoteDetail'
import ReportPage from './pages/ReportPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import UploadPage from './pages/UploadPage'
import ManageNotes from './pages/ManageNotes'
import EditNote from './pages/EditNote'
import ManageCategories from './pages/ManageCategories'
import ManageReports from './pages/ManageReports'
import ComingSoon from './pages/ComingSoon'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/note/:id" element={<NoteDetail />} />
          <Route path="/report/:id" element={<ReportPage />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allow={['admin', 'contributor']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/upload"
            element={
              <ProtectedRoute allow={['admin', 'contributor']}>
                <UploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/notes"
            element={
              <ProtectedRoute allow={['admin']}>
                <ManageNotes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/notes/:id/edit"
            element={
              <ProtectedRoute allow={['admin']}>
                <EditNote />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <ProtectedRoute allow={['admin']}>
                <ManageCategories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allow={['admin']}>
                <ManageReports />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<ComingSoon />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}