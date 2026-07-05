import React, { useState } from 'react';
import { GoogleLoginButton } from './GoogleLoginButton';
import './LoginModal.css';

interface LoginModalProps {
  isOpen: boolean;
}

/* 登入是進入應用的必經關卡，因此以內嵌卡片呈現、不可關閉 */
export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  return (
    <div className="login-card">
      {error && (
        <div className="error-message" role="alert">
          <div className="error-text">
            <strong>登入失敗</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <GoogleLoginButton onError={handleError} />

      <p className="info-text">
        使用 Google 帳號登入。只有獲得授權的帳號才能存取此應用程式。
      </p>
    </div>
  );
};
