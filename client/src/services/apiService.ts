import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { authService } from './authService';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

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

export interface GetUrlsParams {
  limit?: number;
  cursor?: string;
  sortBy?: 'createdAt';
  order?: 'desc' | 'asc';
  search?: string;
  source?: string;
  tags?: string[];
}

export interface PaginatedUrlResponse {
  data: UrlData[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    count: number;
  };
}

class ApiService {
  private readonly API_BASE = API_CONFIG.BASE_URL;
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: this.API_BASE,
      timeout: API_CONFIG.TIMEOUT,
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
   * Get all URLs (legacy method for backward compatibility)
   */
  async getUrls(params?: GetUrlsParams): Promise<UrlData[] | PaginatedUrlResponse> {
    try {
      if (params) {
        // Use paginated endpoint
        const response: AxiosResponse<PaginatedUrlResponse> = await this.client.get(API_ENDPOINTS.URLS, {
          params: {
            limit: params.limit,
            cursor: params.cursor,
            sortBy: params.sortBy,
            order: params.order,
            search: params.search,
            source: params.source,
            tags: params.tags?.join(',')
          }
        });
        return response.data;
      } else {
        // Legacy endpoint
        const response: AxiosResponse<UrlData[]> = await this.client.get(API_ENDPOINTS.URLS);
        return response.data;
      }
    } catch (error) {
      console.error('Failed to fetch URLs:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get URLs with pagination
   */
  async getUrlsPaginated(params: GetUrlsParams): Promise<PaginatedUrlResponse> {
    try {
      const response: AxiosResponse<PaginatedUrlResponse> = await this.client.get(API_ENDPOINTS.URLS, {
        params: {
          limit: params.limit || 50,
          cursor: params.cursor,
          sortBy: params.sortBy || 'createdAt',
          order: params.order || 'desc',
          search: params.search,
          source: params.source,
          tags: params.tags?.join(',')
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch URLs with pagination:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Add new URL
   */
  async addUrl(urlData: AddUrlRequest): Promise<AddUrlResponse> {
    try {
      const response: AxiosResponse<AddUrlResponse> = await this.client.post(API_ENDPOINTS.URLS, urlData);
      return response.data;
    } catch (error) {
      console.error('Failed to add URL:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete URL (soft delete)
   */
  async deleteUrl(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response: AxiosResponse<{ success: boolean; message: string }> = await this.client.delete(`${API_ENDPOINTS.URLS}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete URL:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; uptime: number }> {
    try {
      const response = await this.client.get(API_ENDPOINTS.HEALTH);
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