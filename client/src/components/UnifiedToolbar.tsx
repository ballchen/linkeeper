import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './UnifiedToolbar.css';

type LayoutMode = 'compact' | 'comfortable' | 'spacious' | 'list';

interface UnifiedToolbarProps {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const UnifiedToolbar: React.FC<UnifiedToolbarProps> = ({ 
  layoutMode, 
  onLayoutChange 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get layout configuration
  const getLayoutConfig = (mode: LayoutMode) => {
    const configs = {
      compact: {
        name: 'Compact',
        icon: '▣',
        description: 'Show more URLs'
      },
      comfortable: {
        name: 'Comfortable',
        icon: '⊞',
        description: 'Balanced view'
      },
      spacious: {
        name: 'Spacious',
        icon: '☐',
        description: 'Larger cards'
      },
      list: {
        name: 'List',
        icon: '☰',
        description: 'Single column'
      }
    };
    return configs[mode];
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  if (!user) {
    return null; // Don't show toolbar if not authenticated
  }

  return (
    <div className="unified-toolbar" ref={dropdownRef}>
      {/* Main Trigger Button */}
      <button 
        className={`toolbar-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="開啟工具選單"
      >
        {/* User Avatar Only */}
        <div className="trigger-avatar">
          {user.picture ? (
            <img src={user.picture} alt={user.name} />
          ) : (
            <div className="avatar-placeholder">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="toolbar-dropdown">
          {/* User Info - Compact */}
          <div className="dropdown-section user-section-compact">
            <div className="user-name-compact">{user.name}</div>
            <div className="user-email-compact">{user.email}</div>
          </div>

          <div className="dropdown-divider"></div>

          {/* Quick Actions - Compact */}
          <div className="dropdown-section">
            <Link 
              to="/add" 
              className="dropdown-action-compact"
              onClick={() => setIsOpen(false)}
            >
              <span className="action-icon-compact">➕</span>
              <span className="action-text-compact">新增 URL</span>
            </Link>
          </div>

          <div className="dropdown-divider"></div>

          {/* Layout Options - Compact */}
          <div className="dropdown-section">
            <div className="layout-title-compact">檢視模式</div>
            <div className="layout-options-grid">
              {(['compact', 'comfortable', 'spacious', 'list'] as LayoutMode[]).map((mode) => {
                const config = getLayoutConfig(mode);
                return (
                  <button
                    key={mode}
                    className={`layout-option-compact ${layoutMode === mode ? 'active' : ''}`}
                    onClick={(event) => {
                      onLayoutChange(mode, event);
                      setIsOpen(false);
                    }}
                    title={config.description}
                  >
                    <span className="layout-icon-compact">{config.icon}</span>
                    <span className="layout-name-compact">{config.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dropdown-divider"></div>

          {/* Logout - Compact */}
          <div className="dropdown-section">
            <button 
              className="dropdown-action-compact logout-compact"
              onClick={handleLogout}
            >
              <span className="action-icon-compact">🚪</span>
              <span className="action-text-compact">登出</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 