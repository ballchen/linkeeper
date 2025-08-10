import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import InfiniteScroll from 'react-infinite-scroll-component'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { LoginModal } from './components/LoginModal'
import { UnifiedToolbar } from './components/UnifiedToolbar'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
import { useLongPress } from './hooks/useLongPress'
import { apiService } from './services/apiService'
import type { UrlData } from './services/apiService'
import { API_CONFIG, API_ENDPOINTS } from './config/api'
import AddUrlPage from './AddUrlPage'
import './App.css'

// Import SVG icons
import FacebookIcon from './assets/icons/facebook.svg'
import InstagramIcon from './assets/icons/instagram.svg'
import ThreadsIcon from './assets/icons/threads.svg'
import YouTubeIcon from './assets/icons/youtube.svg'

type UrlSource = 'facebook' | 'instagram' | 'threads' | 'youtube';
type LayoutMode = 'compact' | 'comfortable' | 'spacious' | 'list';

// Memoized UrlCard component to prevent unnecessary re-renders
interface UrlCardProps {
  urlData: UrlData;
  index: number;
  layoutMode: LayoutMode;
  sourceInfo: {
    icon: string;
    name: string;
    color: string;
  } | null;
  onLongPress: (urlData: UrlData) => void;
  onCopy: (url: string) => void;
  formatDate: (dateString: string) => string;
}

const UrlCard = memo<UrlCardProps>(({ 
  urlData, 
  index, 
  layoutMode, 
  sourceInfo, 
  onLongPress, 
  onCopy, 
  formatDate 
}) => {
  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress(urlData),
    delay: 700,
    shouldPreventDefault: true
  });

  return (
    <div 
      key={urlData._id} 
      className={`url-card layout-${layoutMode}`}
      style={{ animationDelay: `${index * 0.1}s` }}
      {...longPressHandlers}
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
          <span className="placeholder-text">沒有預覽</span>
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
          {urlData.title || '沒有標題'}
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
            <span className="link-text">訪問連結</span>
          </a>
          
          <button 
            onClick={() => onCopy(urlData.url)}
            className="share-btn"
            title="複製 URL 到剪貼板"
          >
            <span className="share-icon">📋</span>
            <span className="share-text">分享</span>
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
});

// Main App Content Component (only rendered when authenticated)
function AppContent() {
  const [urls, setUrls] = useState<UrlData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('comfortable');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<UrlData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const processedStateRef = useRef<string | null>(null);

  const location = useLocation();
  const { showToast } = useToast();

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

  // Fetch initial URLs
  const fetchInitialUrls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getUrlsPaginated({
        limit: 50,
        sortBy: 'createdAt',
        order: 'desc'
      });
      
      setUrls(response.data);
      setHasMore(response.pagination.hasMore);
      setNextCursor(response.pagination.nextCursor);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch URLs. Make sure the server is running.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('Error fetching URLs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch more URLs for infinite scroll
  const fetchMoreUrls = useCallback(async () => {
    if (!hasMore || !nextCursor) return;
    
    try {
      const response = await apiService.getUrlsPaginated({
        limit: 50,
        cursor: nextCursor,
        sortBy: 'createdAt',
        order: 'desc'
      });
      
      setUrls(prev => [...prev, ...response.data]);
      setHasMore(response.pagination.hasMore);
      setNextCursor(response.pagination.nextCursor);
    } catch (err) {
      // Show error toast for load more failure
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more URLs';
      showToast(errorMessage, 'error');
      console.error('Error fetching more URLs:', err);
      throw err; // Re-throw for InfiniteScroll error handling
    }
  }, [hasMore, nextCursor, showToast]);

  // Handle URL deletion
  const handleDeleteUrl = useCallback(async () => {
    if (!urlToDelete) return;

    setIsDeleting(true);
    try {
      await apiService.deleteUrl(urlToDelete._id);
      
      // Remove URL from state
      setUrls(prevUrls => prevUrls.filter(url => url._id !== urlToDelete._id));
      
      // Show success toast
      showToast('連結已刪除 🗑️', 'success');
      
      // Close modal
      setDeleteModalOpen(false);
      setUrlToDelete(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '刪除失敗';
      showToast(`刪除失敗: ${errorMessage}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [urlToDelete, showToast]);

  // Handle long press on URL card
  const handleLongPress = useCallback((urlData: UrlData) => {
    // Prevent multiple modal opens
    if (deleteModalOpen) return;
    
    setUrlToDelete(urlData);
    setDeleteModalOpen(true);
    
    // Add haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [deleteModalOpen]);

  useEffect(() => {
    fetchInitialUrls();
  }, [fetchInitialUrls]);

  // Handle navigation state message
  useEffect(() => {
    if (location.state?.message) {
      // Create a unique key for this state to prevent duplicate processing
      const stateKey = `${location.state.message}-${location.state.type || 'success'}`;
      
      // Skip if we've already processed this exact state
      if (processedStateRef.current === stateKey) {
        return;
      }
      
      processedStateRef.current = stateKey;
      
      // Show toast for navigation state message
      showToast(location.state.message, location.state.type || 'success');
      
      // Clear the state to prevent showing the message again on refresh
      window.history.replaceState(null, '', window.location.pathname);
      
      // Reset the ref after a short delay to allow for new messages
      setTimeout(() => {
        processedStateRef.current = null;
      }, 1000);
    }
  }, [location.state, showToast]);

  const formatDate = useCallback((dateString: string) => {
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
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">載入您儲存的 URL...</p>
        </div>
      </div>
    );
  }

  if (error && urls.length === 0) {
    return (
      <div className="app">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>糟糕！出現了問題</h2>
          <p>{error}</p>
          <button onClick={fetchInitialUrls} className="retry-btn">
            <span>🔄</span>
            重試
          </button>
        </div>
      </div>
    );
  }

  const currentLayoutConfig = getLayoutConfig(layoutMode);

  return (
    <div className="app">
      <main className="main">
        {urls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h2>尚未儲存任何 URL</h2>
            <p>發送 URL 到您的 Telegram 機器人，它就會出現在這裡！</p>
            <div className="empty-steps">
              <div className="step">
                <span className="step-number">1</span>
                <span>開啟 Telegram</span>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <span>找到您的機器人</span>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <span>發送任何 URL</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Unified Toolbar */}
            <UnifiedToolbar 
              layoutMode={layoutMode} 
              onLayoutChange={handleLayoutChange} 
            />
            
            <InfiniteScroll
              dataLength={urls.length}
              next={fetchMoreUrls}
              hasMore={hasMore}
              loader={
                <div className="loading-more">
                  <div className="loading-spinner"></div>
                  <span>載入更多...</span>
                </div>
              }
              endMessage={
                <div className="no-more-data">
                  <span>已載入所有資料</span>
                </div>
              }
              scrollThreshold={0.9}
              className="infinite-scroll-container"
            >
              <div 
                className={`url-grid layout-${layoutMode}`}
                style={{ 
                  gridTemplateColumns: currentLayoutConfig.columns 
                }}
              >
                {urls.map((urlData, index) => {
                  const sourceInfo = getSourceInfo(urlData.source);
                  
                  return (
                    <UrlCard
                      key={urlData._id}
                      urlData={urlData}
                      index={index}
                      layoutMode={layoutMode}
                      sourceInfo={sourceInfo}
                      onLongPress={handleLongPress}
                      onCopy={copyToClipboard}
                      formatDate={formatDate}
                    />
                  );
                })}
              </div>
            </InfiniteScroll>
          </>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUrlToDelete(null);
        }}
        onConfirm={handleDeleteUrl}
        urlTitle={urlToDelete?.title || urlToDelete?.url}
        isLoading={isDeleting}
      />
    </div>
  )
}

// Authentication Wrapper Component
function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Show login modal if not authenticated and not loading
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setShowLoginModal(true);
    } else {
      setShowLoginModal(false);
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="app">
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>正在載入 LinkKeeper...</p>
        </div>
      </div>
    );
  }

  // Show login modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="login-required">
          <div className="login-content">
            <h1 className="app-title">LinkKeeper</h1>
            <p className="login-subtitle">您的個人 URL 管理工具</p>
            <LoginModal 
              isOpen={showLoginModal} 
              onClose={() => setShowLoginModal(false)} 
            />
          </div>
        </div>
      </div>
    );
  }

  // Show main app content when authenticated
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/add" element={<AddUrlPage />} />
      </Routes>
    </ToastProvider>
  );
}

// Main App Component with providers
function App() {
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Get Google Client ID from server on app load
  useEffect(() => {
    const getAuthConfig = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH_CONFIG}`);
        const data = await response.json();
        
        if (data.success && data.config.googleClientId) {
          setGoogleClientId(data.config.googleClientId);
        } else {
          setConfigError('無法取得認證設定');
        }
      } catch (error) {
        console.error('Failed to get auth config:', error);
        setConfigError('無法連接到伺服器');
      }
    };

    getAuthConfig();
  }, []);

  // Show error if we can't get Google Client ID
  if (configError) {
    return (
      <div className="app">
        <div className="config-error">
          <div className="error-icon">⚠️</div>
          <h2>設定錯誤</h2>
          <p>{configError}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">
            <span>🔄</span>
            重新載入
          </button>
        </div>
      </div>
    );
  }

  // Show loading while getting Google Client ID
  if (!googleClientId) {
    return (
      <div className="app">
        <div className="config-loading">
          <div className="loading-spinner"></div>
          <p>正在初始化應用程式...</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App
