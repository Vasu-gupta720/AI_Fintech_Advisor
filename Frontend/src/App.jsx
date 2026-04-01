import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import Header from './components/Header'

const VIEW_ORDER = ['dashboard', 'upload', 'transactions', 'insights']
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

const USER_ID_STORAGE_KEY = 'finai_user_id'
const RECENT_FILES_STORAGE_KEY = 'finai_recent_files_by_user'

const getOrCreateUserId = () => {
  const existing = localStorage.getItem(USER_ID_STORAGE_KEY)
  if (existing && /^\d+$/.test(existing)) {
    return existing
  }

  localStorage.setItem(USER_ID_STORAGE_KEY, '1')
  return '1'
}

const getRecentFilesMap = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_FILES_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

const getRecentFilesForUser = (userId) => {
  const map = getRecentFilesMap()
  return map[userId] || []
}

const setRecentFilesForUser = (userId, files) => {
  const map = getRecentFilesMap()
  map[userId] = files
  localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(map))
}

const clearRecentFilesForUser = (userId) => {
  const map = getRecentFilesMap()
  delete map[userId]
  localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(map))
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState(() => getRecentFilesForUser(getOrCreateUserId()))
  const [recentlyUploadedFile, setRecentlyUploadedFile] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [userSwitchMessage, setUserSwitchMessage] = useState('')
  const [parsedTransactions, setParsedTransactions] = useState([])
  const [userId, setUserId] = useState(getOrCreateUserId)
  const [userIdInput, setUserIdInput] = useState(getOrCreateUserId)
  const [isRecentFilesOpen, setIsRecentFilesOpen] = useState(false)
  const [activeView, setActiveView] = useState('dashboard')
  const [transitionDirection, setTransitionDirection] = useState('down')
  const lastScrollSwitchRef = useRef(0)
  const wheelDeltaRef = useRef(0)

  const summary = {
    totalSpent: 42350,
    totalTransactions: 136,
    topCategory: 'Shopping',
    score: 78,
  }

  const categories = useMemo(
    () => [
      { name: 'Shopping', amount: 16940, color: '#d95f45' },
      { name: 'Food', amount: 12200, color: '#2c7a7b' },
      { name: 'Travel', amount: 7540, color: '#d4a017' },
      { name: 'Bills', amount: 5670, color: '#3f51b5' },
    ],
    [],
  )

  const recentTransactions = useMemo(
    () => [
      { date: '21 Mar', merchant: 'Swiggy', amount: 450, category: 'Food' },
      { date: '20 Mar', merchant: 'Uber', amount: 290, category: 'Travel' },
      { date: '20 Mar', merchant: 'Amazon', amount: 2199, category: 'Shopping' },
      { date: '19 Mar', merchant: 'Electricity Bill', amount: 1780, category: 'Bills' },
      { date: '18 Mar', merchant: 'BigBasket', amount: 1130, category: 'Food' },
      { date: '17 Mar', merchant: 'Zara', amount: 3499, category: 'Shopping' },
    ],
    [],
  )

  const monthlySpending = useMemo(
    () => [
      { month: 'Jan', amount: 31800 },
      { month: 'Feb', amount: 35200 },
      { month: 'Mar', amount: 42350 },
      { month: 'Apr', amount: 38900 },
      { month: 'May', amount: 40100 },
      { month: 'Jun', amount: 36400 },
    ],
    [],
  )

  const totalCategorySpend = categories.reduce((sum, item) => sum + item.amount, 0)
  const currentYear = new Date().getFullYear()

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setRecentlyUploadedFile('')
      setUploadError('')
      setActiveView('upload')
    }
  }

  const handleUploadFile = async () => {
    if (!selectedFile || isUploading) {
      return
    }

    setIsUploading(true)
    setUploadError('')

    try {
      const formData = new FormData()
      formData.append('user_id', userId)
      formData.append('file', selectedFile)

      const response = await fetch(`${API_BASE_URL}/upload-pdf`, {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.detail || 'Upload failed. Please try again.')
      }

      const uploadedEntry = {
        id: Date.now(),
        name: selectedFile.name,
        uploadedAt: new Date().toISOString(),
      }

      setUploadedFiles((prevFiles) => {
        const nextFiles = [uploadedEntry, ...prevFiles]
        setRecentFilesForUser(userId, nextFiles)
        return nextFiles
      })
      setParsedTransactions(payload.transactions || [])
      setRecentlyUploadedFile(
        `${selectedFile.name} (${payload.total_transactions || 0} transactions)`
      )
      setUserSwitchMessage('')
      setSelectedFile(null)

      // Refresh from backend so table shows full history for this user (not only latest upload).
      await loadPersistedTransactions(userId)
      setActiveView('transactions')
    } catch (error) {
      setUploadError(error.message || 'Could not upload file.')
      setParsedTransactions([])
    } finally {
      setIsUploading(false)
    }
  }

  const applyUserId = () => {
    const nextUserId = userIdInput.trim()
    if (!/^\d+$/.test(nextUserId) || Number(nextUserId) <= 0) {
      setUploadError('User ID must be a positive number like 1, 2, 3.')
      return
    }

    localStorage.setItem(USER_ID_STORAGE_KEY, nextUserId)
    // Immediately switch the local UI context so user-specific data never mixes.
    setUploadedFiles(getRecentFilesForUser(nextUserId))
    setParsedTransactions([])
    setUserId(nextUserId)
    setRecentlyUploadedFile('')
    setUploadError('')
    setUserSwitchMessage(`Switched to user ${nextUserId}`)
    setSelectedFile(null)
  }

  const formatUploadTime = (isoValue) =>
    new Date(isoValue).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

  const openRecentFiles = () => {
    setIsRecentFilesOpen(true)
  }

  const closeRecentFiles = () => {
    setIsRecentFilesOpen(false)
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value)

  const formatTransactionDate = (value) => {
    const parsedDate = new Date(value)
    if (Number.isNaN(parsedDate.getTime())) {
      return value
    }

    // Show full date so users can review complete history clearly.
    return parsedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getTransactionDirection = (typeValue) => {
    const normalizedType = String(typeValue || '').toLowerCase()
    if (normalizedType === 'credit') {
      return 'credit'
    }
    if (normalizedType === 'debit') {
      return 'debit'
    }
    return 'unknown'
  }

  const loadPersistedTransactions = useCallback(async (targetUserId) => {
    setIsLoadingTransactions(true)
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/${targetUserId}`)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.detail || 'Could not fetch saved transactions.')
      }

      const backendTransactions = payload.transactions || []
      setParsedTransactions(backendTransactions)

      // Keep recent files aligned with backend data for this user.
      // If DB data is deleted externally, clear stale local recent files.
      if (backendTransactions.length === 0) {
        clearRecentFilesForUser(targetUserId)
        setUploadedFiles([])
      } else {
        setUploadedFiles(getRecentFilesForUser(targetUserId))
      }
      setUploadError('')
    } catch (error) {
      // Keep files isolated per user even if transaction fetch fails.
      setUploadedFiles(getRecentFilesForUser(targetUserId))
      setParsedTransactions([])
      setUploadError(error.message || 'Could not load saved transactions.')
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [])

  useEffect(() => {
    loadPersistedTransactions(userId)
  }, [userId, loadPersistedTransactions])

  const handleScreenScroll = (event) => {
    if (Math.abs(event.deltaY) < 2) {
      return
    }

    event.preventDefault()

    const now = Date.now()
    const minSwitchGap = 500

    if (now - lastScrollSwitchRef.current < minSwitchGap) {
      return
    }

    wheelDeltaRef.current += event.deltaY
    const triggerThreshold = 70

    if (Math.abs(wheelDeltaRef.current) < triggerThreshold) {
      return
    }

    const direction = wheelDeltaRef.current > 0 ? 1 : -1
    setTransitionDirection(direction > 0 ? 'down' : 'up')

    setActiveView((currentView) => {
      const currentIndex = VIEW_ORDER.indexOf(currentView)
      if (currentIndex === -1) {
        return VIEW_ORDER[0]
      }

      const nextIndex = Math.min(
        Math.max(currentIndex + direction, 0),
        VIEW_ORDER.length - 1,
      )

      return VIEW_ORDER[nextIndex]
    })

    wheelDeltaRef.current = 0
    lastScrollSwitchRef.current = now
    event.preventDefault()
  }

  const handleUploadListWheel = (event) => {
    event.preventDefault()
    event.stopPropagation()

    const scroller = event.currentTarget
    scroller.scrollTop += event.deltaY
  }

  const renderActiveScreen = () => {
    if (activeView === 'dashboard') {
      return (
        <section
          key="dashboard"
          className={`panel highlight screen-panel screen-transition ${transitionDirection === 'down' ? 'slide-from-bottom' : 'slide-from-top'}`}
          id="dashboard"
        >
          <h2>Financial Snapshot</h2>
          <p className="panel-subtitle">Your latest month at a glance</p>
          <div className="cards-grid">
            <article className="metric-card">
              <span>Total Spending</span>
              <strong>{formatCurrency(summary.totalSpent)}</strong>
            </article>
            <article className="metric-card">
              <span>Transactions</span>
              <strong>{summary.totalTransactions}</strong>
            </article>
            <article className="metric-card">
              <span>Top Category</span>
              <strong>{summary.topCategory}</strong>
            </article>
            <article className="metric-card score">
              <span>Financial Health Score</span>
              <strong>{summary.score}/100</strong>
            </article>
          </div>

          <div className="dashboard-charts-grid">
            <article className="chart-card">
              <h3>Category Breakdown</h3>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {categories.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="chart-card">
              <h3>Monthly Spending</h3>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySpending}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        </section>
      )
    }

    if (activeView === 'upload') {
      return (
        <section
          key="upload"
          className={`panel highlight screen-panel screen-transition ${transitionDirection === 'down' ? 'slide-from-bottom' : 'slide-from-top'}`}
          id="upload"
        >
          <h2>Upload Monthly Statement</h2>
          <p className="panel-subtitle">CSV, XLSX or PDF from GPay, Paytm, PhonePe, or bank app</p>

          <div className="user-id-card">
            <p className="user-id-label">Current User ID</p>
            <div className="user-id-actions">
              <input
                type="text"
                value={userIdInput}
                onChange={(event) => setUserIdInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applyUserId()
                  }
                }}
                className="user-id-input"
                placeholder="Enter numeric user id"
              />
              <button type="button" className="recent-files-btn" onClick={applyUserId}>
                Switch User
              </button>
            </div>
            <p className="panel-subtitle">Active user: {userId}. Press Enter or click Switch User.</p>
          </div>

          <label className="upload-zone" htmlFor="statement-upload">
            <input
              id="statement-upload"
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={handleFileChange}
            />
            <span className="upload-title">Drag and drop or click to upload</span>
            <span className="upload-desc">We will auto-detect merchant, amount, and date fields</span>
          </label>

          <div className="upload-actions">
            <span className="upload-file-name">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}
            </span>
            <div className="upload-action-buttons">
              <button
                type="button"
                className="recent-files-btn"
                onClick={openRecentFiles}
              >
                Recent Files ({uploadedFiles.length})
              </button>
              <button
                type="button"
                className="upload-btn"
                onClick={handleUploadFile}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload File'}
              </button>
            </div>
          </div>

          <div className="upload-status" role="status" aria-live="polite">
            {recentlyUploadedFile ? (
              <>
                <p>
                  <strong>{recentlyUploadedFile}</strong> uploaded successfully
                </p>
                <p>Transactions parsed and stored in your backend database.</p>
              </>
            ) : userSwitchMessage ? (
              <p>{userSwitchMessage}</p>
            ) : uploadError ? (
              <p>{uploadError}</p>
            ) : isUploading ? (
              <p>Uploading your statement. Please wait...</p>
            ) : isLoadingTransactions ? (
              <p>Loading your saved transactions...</p>
            ) : (
              <p>Select a statement and click Upload File to import expenses.</p>
            )}
          </div>
        </section>
      )
    }

    if (activeView === 'transactions') {
      return (
        <section
          key="transactions"
          className={`panel highlight screen-panel screen-transition ${transitionDirection === 'down' ? 'slide-from-bottom' : 'slide-from-top'}`}
          id="transactions"
        >
          <h2>Recent Transactions</h2>
          <p className="panel-subtitle">Live preview after statement parsing</p>
          <p className="panel-subtitle">Showing data for user: {userId}</p>
          <div className="table-wrap all-transactions-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(parsedTransactions.length > 0 ? parsedTransactions : recentTransactions).map((item) => {
                  const direction = getTransactionDirection(item.type)
                  const rowClass =
                    direction === 'credit'
                      ? 'transaction-row transaction-credit'
                      : direction === 'debit'
                        ? 'transaction-row transaction-debit'
                        : 'transaction-row'

                  const amountClass =
                    direction === 'credit'
                      ? 'amount amount-credit'
                      : direction === 'debit'
                        ? 'amount amount-debit'
                        : 'amount'

                  return (
                    <tr
                      key={`${item.date}-${item.description || item.merchant}-${item.id || 'sample'}`}
                      className={rowClass}
                    >
                      <td>{formatTransactionDate(item.date)}</td>
                      <td>{item.description || item.merchant}</td>
                      <td>
                        <span className="tag">{item.category || item.type}</span>
                      </td>
                      <td className={amountClass}>{formatCurrency(item.amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )
    }

    return (
      <section
        key="insights"
        className={`panel highlight screen-panel screen-transition ${transitionDirection === 'down' ? 'slide-from-bottom' : 'slide-from-top'}`}
        id="insights"
      >
        <h2>AI Spending Insights</h2>
        <p className="panel-subtitle">What your money behavior says this month</p>
        <div className="category-list" aria-label="Category breakdown">
          {categories.map((category) => {
            const width = (category.amount / totalCategorySpend) * 100
            return (
              <article key={category.name} className="category-row">
                <div className="category-head">
                  <span>{category.name}</span>
                  <span>{formatCurrency(category.amount)}</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${width}%`, backgroundColor: category.color }}
                  />
                </div>
              </article>
            )
          })}
        </div>

        <div className="insight-callouts">
          <p>Shopping is 40% of your total spend; reduce this by 15% to improve savings rate.</p>
          <p>Food spend is stable, but weekend spikes are increasing month-over-month.</p>
          <p>Current trend suggests your health score can improve from 78 to 84 next month.</p>
        </div>
      </section>
    )
  }

  return (
    <div className="app-shell" onWheel={handleScreenScroll}>
      <Header activeView={activeView} setActiveView={setActiveView} />

      <main className="main-content">
        {renderActiveScreen()}
      </main>

      {isRecentFilesOpen && (
        <div className="recent-files-overlay" onClick={closeRecentFiles}>
          <section
            className="recent-files-card"
            onClick={(event) => event.stopPropagation()}
            onWheel={handleUploadListWheel}
            aria-label="Recent uploaded files"
          >
            <div className="recent-files-header">
              <h3>Recent Uploaded Files</h3>
              <button type="button" className="close-recent-files-btn" onClick={closeRecentFiles}>
                Close
              </button>
            </div>

            {uploadedFiles.length === 0 ? (
              <p className="empty-upload-list">No uploaded files yet.</p>
            ) : (
              <ul className="uploaded-file-list">
                {uploadedFiles.map((file) => (
                  <li key={file.id} className="uploaded-file-item">
                    <div className="uploaded-file-meta">
                      <span>{file.name}</span>
                      <small>Uploaded: {formatUploadTime(file.uploadedAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <footer className="footer-note">
        <div className="footer-content">
          <div className="footer-brand">
            <strong>FinAI Advisor</strong>
            <span>AI-powered money insights for smarter spending.</span>
          </div>

          <p className="footer-legal">Copyright {currentYear} FinAI Advisor. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
