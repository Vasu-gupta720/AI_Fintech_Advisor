import { useState } from 'react'
import './Header.css'

export default function Header({ activeView, setActiveView }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  const handleLoginSubmit = (e) => {
    e.preventDefault()
    setIsLoggedIn(true)
    setShowLoginModal(false)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setShowProfileMenu(false)
  }

  return (
    <>
      <header className="app-header">
        <div className="header-container">
          {/* Logo Section */}
          <div className="logo-section">
            <div className="logo">
              <span className="logo-icon">₹</span>
              <span className="logo-text">FinAI</span>
            </div>
            <p className="tagline">Smart Money Management</p>
          </div>

          {/* Center Navigation */}
          <nav className="header-nav" aria-label="Main navigation">
            <button
              className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`nav-link ${activeView === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveView('upload')}
            >
              Upload
            </button>
            <button
              className={`nav-link ${activeView === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveView('transactions')}
            >
              Transactions
            </button>
            <button
              className={`nav-link ${activeView === 'insights' ? 'active' : ''}`}
              onClick={() => setActiveView('insights')}
            >
              Insights
            </button>
          </nav>

          {/* Right Section - Auth & Actions */}
          <div className="header-actions">
            {!isLoggedIn ? (
              <button
                className="btn-login"
                onClick={() => setShowLoginModal(true)}
              >
                Login
              </button>
            ) : (
              <>
                <button className="btn-icon" title="Notifications">
                  🔔
                </button>
                <button className="btn-icon" title="Settings">
                  ⚙️
                </button>
                <div className="profile-dropdown">
                  <button
                    className="profile-btn"
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                  >
                    👤 Profile
                  </button>
                  {showProfileMenu && (
                    <div className="dropdown-menu">
                      <a href="#profile">My Profile</a>
                      <a href="#settings">Settings</a>
                      <a href="#help">Help & Support</a>
                      <hr />
                      <button onClick={handleLogout} className="logout-btn">
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Login to FinAI</h2>
              <button
                className="close-btn"
                onClick={() => setShowLoginModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button type="submit" className="btn-submit">
                Login
              </button>
            </form>
            <p className="signup-link">
              Don't have an account? <a href="#signup">Sign up here</a>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
