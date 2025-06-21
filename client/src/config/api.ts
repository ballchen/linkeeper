/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  TIMEOUT: 10000,
} as const;

export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH_CONFIG: '/auth/config',
  AUTH_GOOGLE: '/auth/google',
  AUTH_VERIFY: '/auth/verify',
  AUTH_PROFILE: '/auth/profile',
  
  // URL endpoints
  URLS: '/urls',
  HEALTH: '/health',
} as const; 