import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import CustomerOrderPage from "./pages/CustomerOrderPage";
import CustomerPage from "./pages/CustomerPage";
import { themeStyle } from "./theme";
import { Wrench } from "lucide-react";

export default function App() {
  return (
    <main className="app-shell" style={themeStyle}>
      <div className="page-frame">
        <header className="site-header">
          <Link className="brand" to="/customer">
            Bouvet <span className="brand-mark">Bike</span>
          </Link>
          <nav aria-label="Primary navigation">
            <NavLink className="route-link" to="/admin">
              Admin Login <Wrench size={16} />
            </NavLink>
          </nav>
        </header>
        <Routes>
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/customer/orders/new" element={<CustomerOrderPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/customer" replace />} />
        </Routes>
      </div>
    </main>
  );
}
