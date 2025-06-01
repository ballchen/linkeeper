import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { getUrls, saveUrl } from './db'
import type { UrlData, UrlSource } from './db'

type LayoutMode = 'compact' | 'comfortable' | 'spacious' | 'list';

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
  const [newUrl, setNewUrl] = useState('');


  // Load layout preference from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem('urlSaverLayout') as LayoutMode;
    if (savedLayout && ['compact', 'comfortable', 'spacious', 'list'].includes(savedLayout)) {
      setLayoutMode(savedLayout);
    }
  }, []);

  // Save layout preference to localStorage
  const handleLayoutChange = (newLayout: LayoutMode) => {
    setLayoutMode(newLayout);
    localStorage.setItem('urlSaverLayout', newLayout);
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
      facebook: { icon: '📘', name: 'Facebook', color: '#1877F2' },
      instagram: { icon: '📷', name: 'Instagram', color: '#E4405F' },
      threads: { icon: '🧵', name: 'Threads', color: '#000000' },
      youtube: { icon: '📹', name: 'YouTube', color: '#FF0000' }
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

  const detectSource = (url: string): UrlSource | undefined => {
    const host = new URL(url).hostname;
    if (host.includes('facebook.com')) return 'facebook';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('threads.net')) return 'threads';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  };

  const fetchMetadata = async (url: string) => {
    const res = await fetch(url);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const title = doc.querySelector('title')?.textContent || undefined;
    const desc =
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      undefined;
    const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined;
    return { title, description: desc, image };
  };

  const handleAddUrl = async () => {
    const url = newUrl.trim();
    if (!url) return;
    try {
      const meta = await fetchMetadata(url);
      const data: UrlData = {
        _id: Date.now().toString(),
        url,
        title: meta.title,
        description: meta.description,
        image: meta.image,
        source: detectSource(url),
        createdAt: new Date().toISOString(),
      };
      await saveUrl(data);
      setUrls((prev) => [data, ...prev]);
      setNewUrl('');
      showToast('URL saved!', 'success');
    } catch (err) {
      showToast('Failed to fetch URL metadata. CORS may be blocked.', 'error');
      console.error('Error adding URL:', err);
    }
  };

  // Fetch URLs from IndexedDB
  const fetchUrls = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setRefreshSuccess(false);
      } else {
        setLoading(true);
      }

      const stored = await getUrls();
      setUrls(stored);
      setError(null);
      
      if (isRefresh) {
        // Show success indicator
        setRefreshSuccess(true);
        setTimeout(() => {
          setRefreshSuccess(false);
        }, 2000);
      }
    } catch (err) {
      const errorMessage = 'Failed to load URLs from your browser storage.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('Error fetching URLs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUrls();
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchUrls(true), 30000);
    return () => clearInterval(interval);
  }, [fetchUrls]);

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
        <div className="add-url-form">
          <input
            className="add-url-input"
            type="text"
            placeholder="Enter URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <button className="add-url-btn" onClick={handleAddUrl}>Add</button>
        </div>
        {urls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h2>No URLs saved yet</h2>
            <p>Use the form above to save a URL.</p>
          </div>
        ) : (
          <>
            <div className="layout-controls">
              <div className="layout-buttons">
                {(['compact', 'comfortable', 'spacious', 'list'] as LayoutMode[]).map((mode) => {
                  const config = getLayoutConfig(mode);
                  return (
                    <button
                      key={mode}
                      className={`layout-btn ${layoutMode === mode ? 'active' : ''}`}
                      onClick={() => handleLayoutChange(mode)}
                      title={`${config.name} - ${config.description}`}
                    >
                      <span className="layout-icon">{config.icon}</span>
                      <span className="layout-name">{config.name}</span>
                    </button>
                  );
                })}
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
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.parentElement?.querySelector('.image-placeholder');
                            if (placeholder) {
                              (placeholder as HTMLElement).style.display = 'flex';
                            }
                          }}
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
                          <span className="source-icon">{sourceInfo.icon}</span>
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
                          Visit Link
                        </a>
                        
                        <button 
                          onClick={() => copyToClipboard(urlData.url)}
                          className="share-btn"
                          title="Copy URL to clipboard"
                        >
                          <span className="share-icon">📋</span>
                          Share
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
