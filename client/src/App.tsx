import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
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

import FacebookIcon from './assets/icons/facebook.svg'
import InstagramIcon from './assets/icons/instagram.svg'
import ThreadsIcon from './assets/icons/threads.svg'
import YouTubeIcon from './assets/icons/youtube.svg'

type UrlSource = 'facebook' | 'instagram' | 'threads' | 'youtube';
type LayoutMode = 'compact' | 'comfortable' | 'spacious' | 'list';
type SourceFilter = UrlSource | 'all';

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'threads', label: 'Threads' },
  { value: 'facebook', label: 'Facebook' },
];

const LAYOUT_CONFIGS: Record<LayoutMode, { name: string; icon: string; columns: string; description: string }> = {
  compact: {
    name: '緊湊',
    icon: '▦',
    columns: 'repeat(auto-fill, minmax(240px, 1fr))',
    description: '一次瀏覽更多連結'
  },
  comfortable: {
    name: '舒適',
    icon: '⊞',
    columns: 'repeat(auto-fill, minmax(340px, 1fr))',
    description: '平衡的檢視'
  },
  spacious: {
    name: '寬敞',
    icon: '☐',
    columns: 'repeat(auto-fill, minmax(440px, 1fr))',
    description: '更大的卡片'
  },
  list: {
    name: '列表',
    icon: '☰',
    columns: '1fr',
    description: '單欄清單'
  }
};

const SOURCE_INFO: Record<UrlSource, { icon: string; name: string; color: string }> = {
  facebook: { icon: FacebookIcon, name: 'Facebook', color: '#1877F2' },
  instagram: { icon: InstagramIcon, name: 'Instagram', color: '#E4405F' },
  threads: { icon: ThreadsIcon, name: 'Threads', color: '#000000' },
  youtube: { icon: YouTubeIcon, name: 'YouTube', color: '#FF0000' }
};

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconClear = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

const IconPlus = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);

/* 阻擋卡片的長按/點擊手勢，讓內部按鈕可獨立操作 */
const stopPress = {
  onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  onMouseUp: (e: React.SyntheticEvent) => e.stopPropagation(),
  onTouchStart: (e: React.SyntheticEvent) => e.stopPropagation(),
  onTouchEnd: (e: React.SyntheticEvent) => e.stopPropagation(),
};

interface UrlCardProps {
  urlData: UrlData;
  index: number;
  layoutMode: LayoutMode;
  onLongPress: (urlData: UrlData) => void;
  onDelete: (urlData: UrlData) => void;
  onCopy: (url: string) => void;
  formatDate: (dateString: string) => string;
}

const UrlCard = memo<UrlCardProps>(({
  urlData,
  index,
  layoutMode,
  onLongPress,
  onDelete,
  onCopy,
  formatDate
}) => {
  const sourceInfo = urlData.source ? SOURCE_INFO[urlData.source] : null;

  const openUrl = () => {
    window.open(urlData.url, '_blank', 'noopener,noreferrer');
  };

  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress(urlData),
    onClick: openUrl,
    delay: 700,
    shouldPreventDefault: false
  });

  let hostname = '';
  try {
    hostname = new URL(urlData.url).hostname.replace(/^www\./, '');
  } catch {
    hostname = urlData.url;
  }

  return (
    <article
      className={`url-card layout-${layoutMode}`}
      style={{ animationDelay: `${Math.min(index % 12, 8) * 0.045}s` }}
      role="link"
      tabIndex={0}
      aria-label={urlData.title || urlData.url}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openUrl();
      }}
      {...longPressHandlers}
    >
      <div className="url-image">
        {urlData.image ? (
          <img
            src={urlData.image}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="image-placeholder">
            <span className="placeholder-glyph" aria-hidden="true">{(urlData.title || hostname).charAt(0).toUpperCase()}</span>
            <span className="placeholder-text">{hostname}</span>
          </div>
        )}

        {sourceInfo && (
          <div className="source-badge" style={{ backgroundColor: sourceInfo.color }}>
            <img src={sourceInfo.icon} alt="" className="source-icon" />
            <span className="source-name">{sourceInfo.name}</span>
          </div>
        )}

        <button
          className="card-delete-btn"
          title="刪除連結"
          aria-label="刪除連結"
          {...stopPress}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(urlData);
          }}
        >
          <IconTrash />
        </button>
      </div>

      <div className="url-content">
        <h3 className="url-title">
          {urlData.title || (urlData.status === 'pending' ? '正在抓取標題⋯' : '（沒有標題）')}
        </h3>

        {urlData.description && (
          <p className="url-description">
            {urlData.description}
          </p>
        )}

        {urlData.tags && urlData.tags.length > 0 && (
          <div className="url-tags">
            {urlData.tags.map((tag, tagIndex) => (
              <span key={tagIndex} className="tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="url-meta">
          <span className="url-domain" title={urlData.url}>{hostname}</span>
          <span className="meta-dot" aria-hidden="true">·</span>
          <span className="url-date">{formatDate(urlData.createdAt)}</span>

          <button
            className="card-copy-btn"
            title="複製連結"
            aria-label="複製連結"
            {...stopPress}
            onClick={(e) => {
              e.stopPropagation();
              onCopy(urlData.url);
            }}
          >
            <IconCopy />
            <span>複製</span>
          </button>
        </div>
      </div>
    </article>
  );
});

function AppContent() {
  const [urls, setUrls] = useState<UrlData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('comfortable');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<UrlData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const processedStateRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const location = useLocation();
  const { showToast } = useToast();

  const hasActiveFilter = search !== '' || sourceFilter !== 'all';

  useEffect(() => {
    const savedLayout = localStorage.getItem('urlSaverLayout') as LayoutMode;
    if (savedLayout && Object.keys(LAYOUT_CONFIGS).includes(savedLayout)) {
      setLayoutMode(savedLayout);
    }
  }, []);

  // 搜尋輸入防抖
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleLayoutChange = (newLayout: LayoutMode, event: React.MouseEvent<HTMLButtonElement>) => {
    setLayoutMode(newLayout);
    localStorage.setItem('urlSaverLayout', newLayout);
    event.currentTarget.blur();
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('已複製連結', 'success');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('已複製連結', 'success');
    }
  };

  const fetchInitialUrls = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getUrlsPaginated({
        limit: 50,
        sortBy: 'createdAt',
        order: 'desc',
        search: search || undefined,
        source: sourceFilter === 'all' ? undefined : sourceFilter
      });

      // 忽略過期的回應（使用者已再次更改搜尋條件）
      if (requestId !== requestIdRef.current) return;

      setUrls(response.data);
      setHasMore(response.pagination.hasMore);
      setNextCursor(response.pagination.nextCursor);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const errorMessage = err instanceof Error ? err.message : '無法載入連結，請確認伺服器狀態';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('Error fetching URLs:', err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setInitialLoaded(true);
      }
    }
  }, [search, sourceFilter, showToast]);

  const fetchMoreUrls = useCallback(async () => {
    if (!hasMore || !nextCursor) return;

    try {
      const response = await apiService.getUrlsPaginated({
        limit: 50,
        cursor: nextCursor,
        sortBy: 'createdAt',
        order: 'desc',
        search: search || undefined,
        source: sourceFilter === 'all' ? undefined : sourceFilter
      });

      setUrls(prev => [...prev, ...response.data]);
      setHasMore(response.pagination.hasMore);
      setNextCursor(response.pagination.nextCursor);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '載入更多連結失敗';
      showToast(errorMessage, 'error');
      console.error('Error fetching more URLs:', err);
      throw err;
    }
  }, [hasMore, nextCursor, search, sourceFilter, showToast]);

  const handleDeleteUrl = useCallback(async () => {
    if (!urlToDelete) return;

    setIsDeleting(true);
    try {
      await apiService.deleteUrl(urlToDelete._id);
      setUrls(prevUrls => prevUrls.filter(url => url._id !== urlToDelete._id));
      showToast('連結已刪除', 'success');
      setDeleteModalOpen(false);
      setUrlToDelete(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '刪除失敗';
      showToast(`刪除失敗：${errorMessage}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [urlToDelete, showToast]);

  const requestDelete = useCallback((urlData: UrlData) => {
    if (deleteModalOpen) return;

    setUrlToDelete(urlData);
    setDeleteModalOpen(true);

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [deleteModalOpen]);

  useEffect(() => {
    fetchInitialUrls();
  }, [fetchInitialUrls]);

  useEffect(() => {
    if (location.state?.message) {
      const stateKey = `${location.state.message}-${location.state.type || 'success'}`;
      if (processedStateRef.current === stateKey) {
        return;
      }

      processedStateRef.current = stateKey;
      showToast(location.state.message, location.state.type || 'success');
      window.history.replaceState(null, '', window.location.pathname);

      setTimeout(() => {
        processedStateRef.current = null;
      }, 1000);
    }
  }, [location.state, showToast]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((Date.now() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return '剛剛';
    if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`;
    const hours = Math.floor(diffInMinutes / 60);
    if (hours < 24) return `${hours} 小時前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
  }, []);

  const currentLayoutConfig = LAYOUT_CONFIGS[layoutMode];

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="wordmark" aria-label="LinkKeeper 首頁">
          Link<em>Keeper</em>
        </Link>

        <div className="search-box">
          <span className="search-icon"><IconSearch /></span>
          <input
            type="search"
            className="search-input"
            placeholder="搜尋標題、內容或網址⋯"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="搜尋連結"
          />
          {searchInput && (
            <button
              className="search-clear"
              aria-label="清除搜尋"
              onClick={() => setSearchInput('')}
            >
              <IconClear />
            </button>
          )}
        </div>

        <UnifiedToolbar
          layoutMode={layoutMode}
          onLayoutChange={handleLayoutChange}
        />
      </header>

      <div className="filter-row" role="group" aria-label="來源篩選">
        {SOURCE_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            className={`filter-chip ${sourceFilter === value ? 'active' : ''}`}
            onClick={() => setSourceFilter(value)}
            aria-pressed={sourceFilter === value}
          >
            {label}
          </button>
        ))}
        {initialLoaded && loading && <span className="filter-loading" aria-label="搜尋中" />}
      </div>

      <main className="main">
        {!initialLoaded ? (
          <div className="loading-container">
            <div className="loading-spinner" aria-hidden="true"></div>
            <p className="loading-text">正在載入你收藏的連結⋯</p>
          </div>
        ) : error && urls.length === 0 ? (
          <div className="error-container">
            <h2>糟糕，出了點問題</h2>
            <p>{error}</p>
            <button onClick={fetchInitialUrls} className="retry-btn">
              重試
            </button>
          </div>
        ) : urls.length === 0 && loading ? (
          <div className="loading-container">
            <div className="loading-spinner" aria-hidden="true"></div>
            <p className="loading-text">搜尋中⋯</p>
          </div>
        ) : urls.length === 0 && hasActiveFilter ? (
          <div className="empty-state">
            <h2>找不到符合的連結</h2>
            <p>換個關鍵字，或清除篩選條件再試一次。</p>
            <button
              className="retry-btn"
              onClick={() => {
                setSearchInput('');
                setSourceFilter('all');
              }}
            >
              清除篩選
            </button>
          </div>
        ) : urls.length === 0 ? (
          <div className="empty-state">
            <h2>收藏庫還是空的</h2>
            <p>把連結傳給你的 Telegram 機器人，或按右下角的「＋」直接新增。</p>
            <div className="empty-steps">
              <div className="step">
                <span className="step-number">1</span>
                <span>開啟 Telegram</span>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <span>找到你的機器人</span>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <span>傳送任何連結</span>
              </div>
            </div>
          </div>
        ) : (
          <InfiniteScroll
            dataLength={urls.length}
            next={fetchMoreUrls}
            hasMore={hasMore}
            loader={
              <div className="loading-more">
                <div className="loading-spinner"></div>
                <span>載入更多⋯</span>
              </div>
            }
            endMessage={
              <div className="no-more-data">
                <span>—— 已經到底了 ——</span>
              </div>
            }
            scrollThreshold={0.9}
            className="infinite-scroll-container"
          >
            <div
              className={`url-grid layout-${layoutMode} ${loading ? 'is-refreshing' : ''}`}
              style={{
                gridTemplateColumns: currentLayoutConfig.columns
              }}
            >
              {urls.map((urlData, index) => (
                <UrlCard
                  key={urlData._id}
                  urlData={urlData}
                  index={index}
                  layoutMode={layoutMode}
                  onLongPress={requestDelete}
                  onDelete={requestDelete}
                  onCopy={copyToClipboard}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </InfiniteScroll>
        )}
      </main>

      <Link to="/add" className="fab" aria-label="新增連結" title="新增連結">
        <IconPlus />
      </Link>

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

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app">
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>正在載入 LinkKeeper⋯</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="login-required">
          <div className="login-content">
            <h1 className="app-title">Link<em>Keeper</em></h1>
            <p className="login-subtitle">你的個人連結收藏庫</p>
            <LoginModal isOpen />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/add" element={<AddUrlPage />} />
      </Routes>
    </ToastProvider>
  );
}

function App() {
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

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

  if (configError) {
    return (
      <div className="app">
        <div className="config-error">
          <h2>設定錯誤</h2>
          <p>{configError}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">
            重新載入
          </button>
        </div>
      </div>
    );
  }

  if (!googleClientId) {
    return (
      <div className="app">
        <div className="config-loading">
          <div className="loading-spinner"></div>
          <p>正在初始化應用程式⋯</p>
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
