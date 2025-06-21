import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserProfile.css';

export const UserProfile: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (isLoading || !user) {
    return (
      <div className="user-profile-loading">
        <div className="skeleton-avatar"></div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(prev => !prev);
  };

  const formatLastLogin = (lastLoginAt: string) => {
    const date = new Date(lastLoginAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} 天前`;
    } else if (diffHours > 0) {
      return `${diffHours} 小時前`;
    } else {
      return '剛剛';
    }
  };

  return (
    <div className="user-profile">
      <div className="user-profile-trigger" onClick={toggleDropdown}>
        <div className="user-avatar">
          {user.picture ? (
            <img src={user.picture} alt={user.name} />
          ) : (
            <div className="avatar-placeholder">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="user-info">
          <div className="user-name">{user.name}</div>
          <div className="user-email">{user.email}</div>
        </div>
        <div className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>
          ▼
        </div>
      </div>

      {isDropdownOpen && (
        <div className="user-dropdown">
          <div className="dropdown-header">
            <div className="user-details">
              <div className="user-name-large">{user.name}</div>
              <div className="user-email-small">{user.email}</div>
              <div className="last-login">
                上次登入：{formatLastLogin(user.lastLoginAt)}
              </div>
            </div>
          </div>
          
          <div className="dropdown-divider"></div>
          
          <div className="dropdown-actions">
            <button 
              className="logout-button"
              onClick={handleLogout}
            >
              <span className="logout-icon">🚪</span>
              登出
            </button>
          </div>
        </div>
      )}

      {isDropdownOpen && (
        <div 
          className="dropdown-overlay" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
}; 