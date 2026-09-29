import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Bot, Clapperboard, Plus, Sparkles } from 'lucide-react'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Sparkles size={20} color="#818cf8" />
          Nô Tì <span>Agent</span>
        </div>
        <button className="btn-new" onClick={() => navigate('/')} type="button">
          <Plus size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          Tác vụ mới
        </button>
        <div className="sidebar-section">Điều hướng</div>
        <NavLink to="/" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} end>
          <Bot size={18} /> Agent (Manus)
        </NavLink>
        <NavLink to="/studio" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Clapperboard size={18} /> Studio (CapCut)
        </NavLink>
        <div className="sidebar-section">Gần đây</div>
        <div className="task-list">
          <div className="task-item active">Tác vụ hiện tại</div>
        </div>
      </aside>
      <ErrorBoundary key={location.pathname}>
        <Outlet />
      </ErrorBoundary>
    </div>
  )
}
