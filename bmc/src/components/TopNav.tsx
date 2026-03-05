import { NavLink } from 'react-router-dom'

export const TopNav = () => (
  <header className="top-nav" aria-label="Primary navigation">
    <h1 className="site-header">Big Money Crypto</h1>

    <nav className="nav-links" aria-label="Pages">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
      >
        Home
      </NavLink>
      <NavLink
        to="/my-bot"
        className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
      >
        My Bot
      </NavLink>
    </nav>

    <button type="button" className="profile-btn" aria-label="Open profile">
      👤
    </button>
  </header>
)
