import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { authService } from './authService';

export interface UrlData {
  _id: string;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  source?: 'facebook' | 'instagram' | 'threads' | 'youtube';
  tags?: string[];
  createdAt: string;
}

export interface AddUrlRequest {
  url: string;
}

export interface AddUrlResponse {
  message: string;
  url: UrlData;
}

class ApiService {
  private readonly API_BASE = 'http://localhost:4000/api';
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: this.API_BASE,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add authentication headers
    this.client.interceptors.request.use(
      (config) => {
        const authHeaders = authService.getAuthHeader();
        Object.assign(config.headers, authHeaders);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle authentication errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, logout user
          authService.logout();
          window.location.reload(); // This will trigger the login modal
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all URLs
   */
  async getUrls(): Promise<UrlData[]> {
    try {
      const response: AxiosResponse<UrlData[]> = await this.client.get('/urls');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch URLs:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Add new URL
   */
  async addUrl(urlData: AddUrlRequest): Promise<AddUrlResponse> {
    try {
      const response: AxiosResponse<AddUrlResponse> = await this.client.post('/urls', urlData);
      return response.data;
    } catch (error) {
      console.error('Failed to add URL:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; uptime: number }> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors consistently
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message || 'An unknown error occurred';
      const status = error.response?.status;
      
      if (status === 401) {
        return new Error('Authentication required. Please login again.');
      } else if (status === 403) {
        return new Error('You are not authorized to access this resource.');
      } else if (status === 404) {
        return new Error('The requested resource was not found.');
      } else if (status === 500) {
        return new Error('Server error. Please try again later.');
      } else if (status && status >= 400) {
        return new Error(`Request failed: ${message}`);
      } else if (error.code === 'ECONNABORTED') {
        return new Error('Request timeout. Please check your connection.');
      } else if (error.code === 'ERR_NETWORK') {
        return new Error('Network error. Please check your connection and server status.');
      }
      
      return new Error(message);
    }
    
    return new Error('An unexpected error occurred');
  }

  /**
   * Update API base URL (useful for environment switching)
   */
  updateBaseURL(newBaseURL: string): void {
    this.client.defaults.baseURL = newBaseURL;
  }

  /**
   * Get current API base URL
   */
  getBaseURL(): string {
    return this.client.defaults.baseURL || this.API_BASE;
  }
}

// Export singleton instance
export const apiService = new ApiService(); 