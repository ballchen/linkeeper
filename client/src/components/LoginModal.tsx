import React, { useState } from 'react';
import { GoogleLoginButton } from './GoogleLoginButton';
import './LoginModal.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  const handleModalClick = (e: React.MouseEvent) => {
    // Prevent closing modal when clicking inside the modal content
    e.stopPropagation();
  };

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-content" onClick={handleModalClick}>
        <div className="login-modal-header">
          <h2>登入 LinkKeeper</h2>
          <button className="close-button" onClick={onClose} aria-label="關閉">
            ×
          </button>
        </div>

        <div className="login-modal-body">
          <p className="login-description">
            請使用您的 Google 帳號登入以存取 LinkKeeper。
          </p>

          {error && (
            <div className="error-message">
              <div className="error-icon">⚠️</div>
              <div className="error-text">
                <strong>登入失敗</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          <GoogleLoginButton onError={handleError} />

          <div className="login-info">
            <p className="info-text">
              只有獲得授權的帳號才能存取此應用程式。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 