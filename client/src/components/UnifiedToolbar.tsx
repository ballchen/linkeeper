import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './UnifiedToolbar.css';

type LayoutMode = 'compact' | 'comfortable' | 'spacious' | 'list';

interface UnifiedToolbarProps {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode, event: React.MouseEvent<HTMLButtonElement>) => void;
}

const LAYOUT_OPTIONS: { mode: LayoutMode; name: string; icon: string; description: string }[] = [
  { mode: 'compact', name: '緊湊', icon: '▦', description: '一次瀏覽更多連結' },
  { mode: 'comfortable', name: '舒適', icon: '⊞', description: '平衡的檢視' },
  { mode: 'spacious', name: '寬敞', icon: '☐', description: '更大的卡片' },
  { mode: 'list', name: '列表', icon: '☰', description: '單欄清單' },
];

export const UnifiedToolbar: React.FC<UnifiedToolbarProps> = ({
  layoutMode,
  onLayoutChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="unified-toolbar" ref={dropdownRef}>
      <button
        className={`toolbar-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="開啟使用者選單"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div className="trigger-avatar">
          {user.picture ? (
            <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
          ) : (
            <div className="avatar-placeholder">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="toolbar-dropdown" role="menu">
          <div className="dropdown-section user-section">
            <div className="user-name">{user.name}</div>
            <div className="user-email">{user.email}</div>
          </div>

          <div className="dropdown-divider"></div>

          <div className="dropdown-section">
            <Link
              to="/add"
              className="dropdown-action"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <span className="action-icon" aria-hidden="true">＋</span>
              <span>新增連結</span>
            </Link>
          </div>

          <div className="dropdown-divider"></div>

          <div className="dropdown-section">
            <div className="layout-title">檢視模式</div>
            <div className="layout-options-grid">
              {LAYOUT_OPTIONS.map(({ mode, name, icon, description }) => (
                <button
                  key={mode}
                  className={`layout-option ${layoutMode === mode ? 'active' : ''}`}
                  role="menuitem"
                  onClick={(event) => {
                    onLayoutChange(mode, event);
                    setIsOpen(false);
                  }}
                  title={description}
                >
                  <span className="layout-icon" aria-hidden="true">{icon}</span>
                  <span className="layout-name">{name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <div className="dropdown-section">
            <button
              className="dropdown-action logout-action"
              role="menuitem"
              onClick={handleLogout}
            >
              <span className="action-icon" aria-hidden="true">⎋</span>
              <span>登出</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
