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
      setError('請輸入 URL')
      return
    }

    if (!isValidUrl(url.trim())) {
      setError('請輸入有效的 URL（需包含協定，例如 https://）')
      return
    }

    setLoading(true)

    try {
      await apiService.addUrl({ url: url.trim() })

      // Success - navigate back to home
      navigate('/', {
        state: {
          message: 'URL 儲存成功！🎉',
          type: 'success'
        }
      })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('儲存 URL 失敗，請再試一次。')
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
              取消
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <span className="loading-spinner" style={{width: '16px', height: '16px'}}></span>
                  儲存中...
                </>
              ) : (
                <>
                  <span className="save-icon">💾</span>
                  儲存連結
                </>
              )}
            </button>
          </div>
        </form>

        <div className="add-url-tips">
          <h3>💡 小提示</h3>
          <ul>
            <li>確保包含 <code>https://</code> 或 <code>http://</code></li>
            <li>我們將自動獲取頁面標題和描述</li>
            <li>如果 URL 已存在，將會更新其資訊</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AddUrlPage 