declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const runtimeConfig =
  typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined;

// API Base URL resolves in order: runtime config → build-time env → default fallback
export const API_BASE_URL =
  runtimeConfig?.apiBaseUrl ||
  import.meta.env.VITE_API_BASE_URL ||
  DEFAULT_API_BASE_URL;

// API 엔드포인트
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login/',
    LOGOUT: '/api/auth/logout/',
    REFRESH: '/api/auth/refresh/',
  },
  DATA_UPLOAD: {
    UPLOAD: '/api/data-upload/upload/',
    LOGS: '/api/data-upload/logs/',
    STATISTICS: '/api/data-upload/statistics/',
    DELETE: '/api/data-upload/delete/',
  },
  DASHBOARD: {
    SUMMARY: '/api/dashboard/summary/',
    KPI: '/api/dashboard/kpi/',
    PUBLICATIONS: '/api/dashboard/publications/',
    RESEARCH: '/api/dashboard/research/',
    STUDENTS: '/api/dashboard/students/',
    FILTERS: '/api/dashboard/filters/',
    REPORTS: '/api/dashboard/reports/',
  },
} as const;

// 로컬스토리지 키
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
} as const;

// 사용자 역할
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;
