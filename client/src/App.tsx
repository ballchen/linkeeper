import { useState, useEffect, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import axios from 'axios'
import './App.css'

// Import SVG icons
import FacebookIcon from './assets/icons/facebook.svg'
import InstagramIcon from './assets/icons/instagram.svg'
import ThreadsIcon from './assets/icons/threads.svg'
import YouTubeIcon from './assets/icons/youtube.svg'

type UrlSource = 'facebook' | 'instagram' | 'threads' | 'youtube';
type LayoutMode = 'compact' | 'comfortable' | 'spacious' | 'list';

interface UrlData {
  _id: string;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  source?: UrlSource;
  tags?: string[];
  createdAt: string;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}

function App() {
  const [urls, setUrls] = useState<UrlData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('comfortable');

  const location = useLocation();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

  // Load layout preference from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem('urlSaverLayout') as LayoutMode;
    if (savedLayout && ['compact', 'comfortable', 'spacious', 'list'].includes(savedLayout)) {
      setLayoutMode(savedLayout);
    }
  }, []);

  // Save layout preference to localStorage
  const handleLayoutChange = (newLayout: LayoutMode, event: React.MouseEvent<HTMLButtonElement>) => {
    setLayoutMode(newLayout);
    localStorage.setItem('urlSaverLayout', newLayout);
    // Remove focus to hide the layout options after selection
    event.currentTarget.blur();
  };

  // Get layout configuration
  const getLayoutConfig = (mode: LayoutMode) => {
    const configs = {
      compact: {
        name: 'Compact',
        icon: '▣',
        columns: 'repeat(auto-fill, minmax(240px, 1fr))',
        description: 'Show more URLs'
      },
      comfortable: {
        name: 'Comfortable',
        icon: '⊞',
        columns: 'repeat(auto-fill, minmax(350px, 1fr))',
        description: 'Balanced view'
      },
      spacious: {
        name: 'Spacious',
        icon: '☐',
        columns: 'repeat(auto-fill, minmax(450px, 1fr))',
        description: 'Larger cards'
      },
      list: {
        name: 'List',
        icon: '☰',
        columns: '1fr',
        description: 'Single column'
      }
    };
    return configs[mode];
  };

  // Get source icon and display name
  const getSourceInfo = (source?: UrlSource) => {
    const sourceMap = {
      facebook: { icon: FacebookIcon, name: 'Facebook', color: '#1877F2' },
      instagram: { icon: InstagramIcon, name: 'Instagram', color: '#E4405F' },
      threads: { icon: ThreadsIcon, name: 'Threads', color: '#000000' },
      youtube: { icon: YouTubeIcon, name: 'YouTube', color: '#FF0000' }
    };
    return source ? sourceMap[source] : null;
  };

  // Toast notification system (for error messages only now)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    const newToast: ToastMessage = { id, message, type };
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  }, []);

  // Copy to clipboard function
  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('URL copied to clipboard! 📋', 'success');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('URL copied to clipboard! 📋', 'success');
    }
  };

  // Fetch URLs from API
  const fetchUrls = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setRefreshSuccess(false);
      } else {
        setLoading(true);
      }
      
      const response = await axios.get(`${API_BASE_URL}/urls`);
      setUrls(response.data);
      setError(null);
      
      if (isRefresh) {
        // Show success indicator
        setRefreshSuccess(true);
        setTimeout(() => {
          setRefreshSuccess(false);
        }, 2000);
      }
    } catch (err) {
      const errorMessage = 'Failed to fetch URLs. Make sure the server is running.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('Error fetching URLs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_BASE_URL, showToast]);

  useEffect(() => {
    fetchUrls();
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchUrls(true), 30000);
    return () => clearInterval(interval);
  }, [fetchUrls]);

  // Handle navigation state message
  useEffect(() => {
    if (location.state?.message) {
      showToast(location.state.message, location.state.type || 'success');
      // Clear the state to prevent showing the message again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, showToast]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes} minutes ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading your saved URLs...</p>
        </div>
      </div>
    );
  }

  if (error && !refreshing) {
    return (
      <div className="app">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => fetchUrls()} className="retry-btn">
            <span>🔄</span>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentLayoutConfig = getLayoutConfig(layoutMode);

  return (
    <div className="app">
      {/* Refresh Indicator */}
      {(refreshing || refreshSuccess) && (
        <div className="refresh-indicator">
          {refreshing ? (
            <div className="refresh-spinner">🔄</div>
          ) : (
            <div className="refresh-success">✅</div>
          )}
        </div>
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <main className="main">
        {urls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h2>No URLs saved yet</h2>
            <p>Send a URL to your Telegram bot to see it appear here!</p>
            <div className="empty-steps">
              <div className="step">
                <span className="step-number">1</span>
                <span>Open Telegram</span>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <span>Find your bot</span>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <span>Send any URL</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Unified floating toolbar */}
            <div className="floating-toolbar">
              {/* Add URL button */}
              <Link to="/add" className="toolbar-add-btn" title="Add new URL">
                <span className="toolbar-add-icon">➕</span>
              </Link>
              
              {/* Layout controls */}
              <div className="toolbar-layout-controls">
                {/* Current layout indicator (always visible) */}
                <div className="toolbar-layout-indicator">
                  <span className="toolbar-layout-icon">{currentLayoutConfig.icon}</span>
                </div>
                
                {/* Layout options (visible on hover) */}
                <div className="toolbar-layout-options">
                  <div className="toolbar-layout-buttons">
                    {(['compact', 'comfortable', 'spacious', 'list'] as LayoutMode[]).map((mode) => {
                      const config = getLayoutConfig(mode);
                      return (
                        <button
                          key={mode}
                          className={`toolbar-layout-btn ${layoutMode === mode ? 'active' : ''}`}
                          onClick={(event) => handleLayoutChange(mode, event)}
                          title={`${config.name} - ${config.description}`}
                        >
                          <span className="toolbar-btn-icon">{config.icon}</span>
                          <span className="toolbar-btn-name">{config.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <div 
              className={`url-grid layout-${layoutMode}`}
              style={{ 
                gridTemplateColumns: currentLayoutConfig.columns 
              }}
            >
              {urls.map((urlData, index) => {
                const sourceInfo = getSourceInfo(urlData.source);
                return (
                  <div 
                    key={urlData._id} 
                    className={`url-card layout-${layoutMode}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="url-image">
                      {urlData.image ? (
                        <img 
                          src={urlData.image} 
                          alt={urlData.title || 'URL preview'} 
                          loading="lazy"
                        />
                      ) : null}
                      <div className="image-placeholder" style={{ display: urlData.image ? 'none' : 'flex' }}>
                        <span className="placeholder-icon">🔗</span>
                        <span className="placeholder-text">No Preview</span>
                        
                      </div>
                      
                      {/* Source badge */}
                      {sourceInfo && (
                        <div className="source-badge" style={{ backgroundColor: sourceInfo.color }}>
                          <img 
                            src={sourceInfo.icon} 
                            alt={sourceInfo.name} 
                            className="source-icon"
                          />
                          <span className="source-name">{sourceInfo.name}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="url-content">
                      <h3 className="url-title">
                        {urlData.title || 'No title available'}
                      </h3>
                      
                      {urlData.description && (
                        <p className="url-description">
                          {urlData.description}
                        </p>
                      )}
                      
                      {/* Tags */}
                      {urlData.tags && urlData.tags.length > 0 && (
                        <div className="url-tags">
                          {urlData.tags.map((tag, tagIndex) => (
                            <span key={tagIndex} className="tag">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="url-actions">
                        <a 
                          href={urlData.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="url-link"
                        >
                          <span className="link-icon">🔗</span>
                          <span className="link-text">Visit Link</span>
                        </a>
                        
                        <button 
                          onClick={() => copyToClipboard(urlData.url)}
                          className="share-btn"
                          title="Copy URL to clipboard"
                        >
                          <span className="share-icon">📋</span>
                          <span className="share-text">Share</span>
                        </button>
                      </div>
                      
                      <div className="url-meta">
                        <span className="url-date">
                          <span className="date-icon">🕒</span>
                          {formatDate(urlData.createdAt)}
                        </span>
                        <span className="url-domain">
                          {new URL(urlData.url).hostname}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App
