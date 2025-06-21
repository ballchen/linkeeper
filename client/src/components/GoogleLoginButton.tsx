import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import './GoogleLoginButton.css';

interface GoogleLoginButtonProps {
  onError?: (error: string) => void;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onError }) => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      const errorMessage = 'No credential received from Google';
      console.error(errorMessage);
      onError?.(errorMessage);
      return;
    }

    setIsLoading(true);
    
    try {
      await login(credentialResponse.credential);
      console.log('Google login successful');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      console.error('Google login failed:', errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = () => {
    const errorMessage = 'Google login failed or was cancelled';
    console.error(errorMessage);
    onError?.(errorMessage);
  };

  return (
    <div className="google-login-container">
      {isLoading ? (
        <div className="google-login-loading">
          <div className="spinner"></div>
          <span>登入中...</span>
        </div>
      ) : (
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          text="signin_with"
          theme="outline"
          size="large"
          width="280"
        />
      )}
    </div>
  );
}; 