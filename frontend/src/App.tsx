import { Navigate, Route, Routes } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import CustomerPage from './pages/CustomerPage'

export default function App() {
  return (
    <main className="app-shell">
      <Routes>
        <Route path="/customer" element={<CustomerPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Routes>
    </main>
  )
}
