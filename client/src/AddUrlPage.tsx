import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { apiService } from './services/apiService'
import './AddUrlPage.css'

function AddUrlPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="add-url-page">
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>正在檢查認證狀態...</p>
        </div>
      </div>
    );
  }

  // Validate URL format
  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString)
      return true
    } catch {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Reset error
    setError(null)
    
    // Validate URL
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }
    
    if (!isValidUrl(url.trim())) {
      setError('Please enter a valid URL (must include protocol, e.g., https://)')
      return
    }

    setLoading(true)

    try {
      await apiService.addUrl({ url: url.trim() })

      // Success - navigate back to home
      navigate('/', { 
        state: { 
          message: 'URL saved successfully! 🎉',
          type: 'success'
        }
      })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to save URL. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-url-page">
      <div className="add-url-container">
        <div className="add-url-header">
          <h1>新增 URL</h1>
          <p>將 URL 儲存到您的收藏</p>
        </div>

        <form onSubmit={handleSubmit} className="add-url-form">
          <div className="input-group">
            <label htmlFor="url">URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className={`url-input ${error ? 'error' : ''}`}
              disabled={loading}
              autoFocus
            />
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="cancel-btn"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <span className="loading-spinner" style={{width: '16px', height: '16px'}}></span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="save-icon">💾</span>
                  Save URL
                </>
              )}
            </button>
          </div>
        </form>

        <div className="add-url-tips">
          <h3>💡 Tips</h3>
          <ul>
            <li>Make sure to include <code>https://</code> or <code>http://</code></li>
            <li>We'll automatically fetch the title and description</li>
            <li>If the URL already exists, it will be updated</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AddUrlPage 