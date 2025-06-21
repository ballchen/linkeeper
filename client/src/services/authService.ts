export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  lastLoginAt: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  isNewUser: boolean;
}

export interface AuthConfig {
  success: boolean;
  config: {
    googleClientId: string;
    authRequired: boolean;
  };
}

export interface AuthError {
  error: string;
  message: string;
}

import { API_CONFIG, API_ENDPOINTS } from '../config/api';

class AuthService {
  private readonly API_BASE = API_CONFIG.BASE_URL;
  private token: string | null = null;

  constructor() {
    // Initialize token from localStorage on service creation
    this.token = this.getStoredToken();
  }

  /**
   * Get authentication configuration from server
   */
  async getAuthConfig(): Promise<AuthConfig> {
    const response = await fetch(`${this.API_BASE}${API_ENDPOINTS.AUTH_CONFIG}`);
    
    if (!response.ok) {
      throw new Error('Failed to get authentication configuration');
    }

    return await response.json();
  }

  /**
   * Login with Google ID token
   */
  async loginWithGoogle(idToken: string): Promise<LoginResponse> {
    const response = await fetch(`${this.API_BASE}${API_ENDPOINTS.AUTH_GOOGLE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Google login failed');
    }

    // Store token in localStorage and memory
    this.token = data.token;
    this.setStoredToken(data.token);

    return data;
  }

  /**
   * Verify current token
   */
  async verifyToken(): Promise<{ valid: boolean; user?: User }> {
    if (!this.token) {
      return { valid: false };
    }

    try {
      const response = await fetch(`${this.API_BASE}${API_ENDPOINTS.AUTH_VERIFY}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Token is invalid, clear it
        this.clearToken();
        return { valid: false };
      }

      const data = await response.json();
      return { valid: true, user: data.user };
    } catch (error) {
      console.error('Token verification failed:', error);
      this.clearToken();
      return { valid: false };
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    if (!this.token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${this.API_BASE}${API_ENDPOINTS.AUTH_PROFILE}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        throw new Error('Authentication expired. Please login again.');
      }
      throw new Error(data.message || 'Failed to get user profile');
    }

    return data.user;
  }

  /**
   * Logout - clear token
   */
  logout(): void {
    this.clearToken();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Get authorization header for API requests
   */
  getAuthHeader(): Record<string, string> {
    if (!this.token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${this.token}`,
    };
  }

  // Private methods for token management
  private getStoredToken(): string | null {
    try {
      return localStorage.getItem('auth_token');
    } catch (error) {
      console.warn('Failed to read token from localStorage:', error);
      return null;
    }
  }

  private setStoredToken(token: string): void {
    try {
      localStorage.setItem('auth_token', token);
    } catch (error) {
      console.warn('Failed to store token in localStorage:', error);
    }
  }

  private clearToken(): void {
    this.token = null;
    try {
      localStorage.removeItem('auth_token');
    } catch (error) {
      console.warn('Failed to remove token from localStorage:', error);
    }
  }
}

// Export singleton instance
export const authService = new AuthService(); 