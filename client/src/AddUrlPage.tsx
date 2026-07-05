import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { apiService } from './services/apiService'
import './AddUrlPage.css'

function AddUrlPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return (
      <div className="add-url-page">
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>正在檢查登入狀態⋯</p>
        </div>
      </div>
    );
  }

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

    setError(null)

    if (!url.trim()) {
      setError('請輸入網址')
      return
    }

    if (!isValidUrl(url.trim())) {
      setError('網址格式不正確，開頭需包含 https:// 或 http://')
      return
    }

    setLoading(true)

    try {
      await apiService.addUrl({ url: url.trim() })

      navigate('/', {
        state: {
          message: '連結已儲存',
          type: 'success'
        }
      })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('儲存失敗，請再試一次。')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-url-page">
      <div className="add-url-container">
        <div className="add-url-header">
          <Link to="/" className="back-link">← 回到收藏庫</Link>
          <h1>新增連結</h1>
          <p>貼上網址，標題與預覽會自動抓取</p>
        </div>

        <form onSubmit={handleSubmit} className="add-url-form">
          <div className="input-group">
            <label htmlFor="url">網址</label>
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
              <div className="error-message" role="alert">
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
                  <span className="loading-spinner" style={{ width: '16px', height: '16px' }}></span>
                  儲存中⋯
                </>
              ) : (
                '儲存連結'
              )}
            </button>
          </div>
        </form>

        <div className="add-url-tips">
          <h3>小提示</h3>
          <ul>
            <li>網址開頭需包含 <code>https://</code> 或 <code>http://</code></li>
            <li>標題、描述與預覽圖會自動抓取</li>
            <li>如果網址已存在，會更新原本的資料</li>
            <li>也可以直接把連結傳給你的 Telegram 機器人</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AddUrlPage
