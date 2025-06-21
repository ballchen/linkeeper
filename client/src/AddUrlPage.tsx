import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './AddUrlPage.css'

interface AddUrlResponse {
  id: string;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  source?: string;
  tags: string[];
  createdAt: string;
  isNew: boolean;
}

function AddUrlPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

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
      const response = await axios.post<AddUrlResponse>(`${API_BASE_URL}/urls/add`, {
        url: url.trim()
      })

      // Success - navigate back to home
      navigate('/', { 
        state: { 
          message: response.data.isNew 
            ? 'URL saved successfully! 🎉'
            : 'URL already exists and has been updated! 📝',
          type: 'success'
        }
      })
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message)
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
          <h1>Add New URL</h1>
          <p>Save a URL to your collection</p>
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
                  <span className="loading-spinner"></span>
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