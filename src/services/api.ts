import axios from 'axios';

export const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
export const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/v1/ws';

export const api = axios.create({
  baseURL: DEFAULT_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Helper functions for tokens in localStorage
export const getLocalAccessToken = () => localStorage.getItem('saybridge_access_token');
export const setLocalAccessToken = (token: string) => localStorage.setItem('saybridge_access_token', token);
export const removeLocalAccessToken = () => localStorage.removeItem('saybridge_access_token');

export const getLocalRefreshToken = () => localStorage.getItem('saybridge_refresh_token');
export const setLocalRefreshToken = (token: string) => localStorage.setItem('saybridge_refresh_token', token);
export const removeLocalRefreshToken = () => localStorage.removeItem('saybridge_refresh_token');

// Request interceptor: add bearer token
api.interceptors.request.use(
  (config) => {
    const token = getLocalAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: auto-refresh tokens on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getLocalRefreshToken();
        if (refreshToken) {
          let deviceId = localStorage.getItem('saybridge_device_id');
          if (!deviceId) {
            deviceId = `web_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('saybridge_device_id', deviceId);
          }

          const res = await axios.post(`${DEFAULT_API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
            device_id: deviceId,
          });

          const { access_token, refresh_token } = res.data?.data || res.data || {};

          if (!access_token || !refresh_token) {
            throw new Error('Invalid refresh response: missing tokens');
          }

          setLocalAccessToken(access_token);
          setLocalRefreshToken(refresh_token);

          api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
          originalRequest.headers.Authorization = `Bearer ${access_token}`;

          processQueue(null, access_token);
          isRefreshing = false;
          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        // On refresh failure, clear local tokens
        removeLocalAccessToken();
        removeLocalRefreshToken();
        
        // Custom event to trigger redirect to login if necessary
        window.dispatchEvent(new Event('saybridge_auth_failed'));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export function getAuthenticatedFileUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  const token = getLocalAccessToken();
  
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    if (urlOrPath.includes('/files/download/') && !urlOrPath.includes('token=')) {
      const separator = urlOrPath.includes('?') ? '&' : '?';
      return urlOrPath + separator + `token=${encodeURIComponent(token || '')}`;
    }
    return urlOrPath;
  }

  let path = urlOrPath;
  if (path.startsWith('/api/v1')) {
    path = path.substring(7);
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${DEFAULT_API_URL}${path}${separator}token=${encodeURIComponent(token || '')}`;
}

