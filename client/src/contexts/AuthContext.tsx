import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/authService';
import type { User } from '../services/authService';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  googleClientId: string | null;
}

interface AuthContextType extends AuthState {
  login: (idToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    googleClientId: null,
  });

  // Initialize authentication state on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get authentication configuration
        const config = await authService.getAuthConfig();
        
        setAuthState(prev => ({
          ...prev,
          googleClientId: config.config.googleClientId,
        }));

        // Check if user has valid token
        if (authService.isAuthenticated()) {
          const verification = await authService.verifyToken();
          
          if (verification.valid && verification.user) {
            setAuthState(prev => ({
              ...prev,
              isAuthenticated: true,
              user: verification.user!,
              isLoading: false,
            }));
          } else {
            // Token is invalid, clear state
            setAuthState(prev => ({
              ...prev,
              isAuthenticated: false,
              user: null,
              isLoading: false,
            }));
          }
        } else {
          // No token, user not authenticated
          setAuthState(prev => ({
            ...prev,
            isAuthenticated: false,
            user: null,
            isLoading: false,
          }));
        }
      } catch (error) {
        console.error('Failed to initialize authentication:', error);
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: false,
          user: null,
          isLoading: false,
        }));
      }
    };

    initializeAuth();
  }, []);

  const login = async (idToken: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.loginWithGoogle(idToken);
      
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        user: response.user,
        isLoading: false,
      }));
      
      // Show welcome message for new users
      if (response.isNewUser) {
        console.log(`Welcome to LinkKeeper, ${response.user.name}!`);
      } else {
        console.log(`Welcome back, ${response.user.name}!`);
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        isLoading: false,
      }));
      
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Login failed');
      }
    }
  };

  const logout = (): void => {
    authService.logout();
    setAuthState(prev => ({
      ...prev,
      isAuthenticated: false,
      user: null,
      isLoading: false,
    }));
  };

  const refreshUser = async (): Promise<void> => {
    try {
      if (!authService.isAuthenticated()) {
        return;
      }

      const user = await authService.getProfile();
      setAuthState(prev => ({
        ...prev,
        user,
      }));
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
      // If profile fetch fails, user might need to re-authenticate
      logout();
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 