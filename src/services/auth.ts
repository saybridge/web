import { api, setLocalAccessToken, setLocalRefreshToken, removeLocalAccessToken, removeLocalRefreshToken, getLocalAccessToken } from './api';
import { useAuthStore, UserProfile } from '../stores/useAuthStore';

export const getAccessToken = (): string | null => {
  return getLocalAccessToken();
};

export const hasValidSession = (): boolean => {
  return !!getLocalAccessToken();
};

export const login = async (email: string, password: string): Promise<any> => {
  const { setLoading, setError, setTempToken, setSession } = useAuthStore.getState();
  setLoading(true);
  setError(null);

  try {
    let deviceId = localStorage.getItem('saybridge_device_id');
    if (!deviceId) {
      deviceId = `web_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('saybridge_device_id', deviceId);
    }

    const res = await api.post('/auth/login', {
      email,
      password,
      device_id: deviceId,
      device_name: 'React Web Client',
    });

    // Check if 2FA is required
    if (res.data && res.data.success && res.data.data?.['2fa_required']) {
      const tempToken = res.data.data.temp_token;
      setTempToken(tempToken);
      setLoading(false);
      return { '2faRequired': true, tempToken };
    }

    const { access_token, refresh_token } = res.data?.data || res.data || {};
    if (!access_token || !refresh_token) {
      throw new Error('Login failed: missing tokens in response');
    }

    setLocalAccessToken(access_token);
    setLocalRefreshToken(refresh_token);

    api.defaults.headers.common.Authorization = `Bearer ${access_token}`;

    const meRes = await api.get('/users/me');
    const user = meRes.data?.data || meRes.data;

    setSession(user);
    setLoading(false);
    return user;
  } catch (err: any) {
    const errorMsg = err.response?.data?.error || err.message || 'Login failed';
    setError(errorMsg);
    setLoading(false);
    throw new Error(errorMsg);
  }
};

export const verify2FA = async (tempToken: string, code: string): Promise<UserProfile> => {
  const { setLoading, setError, setSession } = useAuthStore.getState();
  setLoading(true);
  setError(null);

  try {
    let deviceId = localStorage.getItem('saybridge_device_id');
    if (!deviceId) {
      deviceId = `web_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('saybridge_device_id', deviceId);
    }

    const res = await api.post('/auth/2fa/verify', {
      temp_token: tempToken,
      code,
      device_id: deviceId,
    });

    const { access_token, refresh_token } = res.data?.data || res.data || {};
    if (!access_token || !refresh_token) {
      throw new Error('Invalid 2FA verification response');
    }

    setLocalAccessToken(access_token);
    setLocalRefreshToken(refresh_token);

    api.defaults.headers.common.Authorization = `Bearer ${access_token}`;

    const meRes = await api.get('/users/me');
    const user = meRes.data?.data || meRes.data;

    setSession(user);
    setLoading(false);
    return user;
  } catch (err: any) {
    const errorMsg = err.response?.data?.error || err.message || '2FA Verification failed';
    setError(errorMsg);
    setLoading(false);
    throw new Error(errorMsg);
  }
};

export const register = async (
  username: string,
  email: string,
  password: string,
  displayName: string
): Promise<any> => {
  const { setLoading, setError } = useAuthStore.getState();
  setLoading(true);
  setError(null);

  try {
    await api.post('/auth/register', {
      username,
      email,
      password,
      display_name: displayName,
    });
    setLoading(false);
    return login(email, password);
  } catch (err: any) {
    const errorMsg = err.response?.data?.error || err.message || 'Registration failed';
    setError(errorMsg);
    setLoading(false);
    throw new Error(errorMsg);
  }
};

export const logout = async (): Promise<void> => {
  const { clearSession } = useAuthStore.getState();
  try {
    const refreshToken = localStorage.getItem('saybridge_refresh_token');
    if (refreshToken) {
      await api.post('/auth/logout', {
        refresh_token: refreshToken,
      }).catch(() => { });
    }
  } catch (e) {
    // Ignore networking errors on signout
  }

  removeLocalAccessToken();
  removeLocalRefreshToken();
  delete api.defaults.headers.common.Authorization;

  clearSession();
};

export const fetchCurrentUser = async (): Promise<UserProfile | null> => {
  const { setSession, clearSession } = useAuthStore.getState();
  const token = getLocalAccessToken();
  if (!token) return null;

  try {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    const meRes = await api.get('/users/me');
    const user = meRes.data?.data || meRes.data;
    setSession(user);
    return user;
  } catch (err) {
    removeLocalAccessToken();
    removeLocalRefreshToken();
    delete api.defaults.headers.common.Authorization;
    clearSession();
    return null;
  }
};
