import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = '/api/v1';

function getStoredTokens(): AuthTokens | null {
  const accessToken = localStorage.getItem('auth_token');
  const refreshToken = localStorage.getItem('refresh_token');
  if (accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }
  return null;
}

function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem('auth_token', tokens.accessToken);
  localStorage.setItem('refresh_token', tokens.refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('auth_user');
}

function getStoredUser(): User | null {
  const raw = localStorage.getItem('auth_user');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function storeUser(user: User): void {
  localStorage.setItem('auth_user', JSON.stringify(user));
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  // Initialize auth state from localStorage
  useEffect(() => {
    const tokens = getStoredTokens();
    const storedUser = getStoredUser();
    if (tokens && storedUser) {
      setUser(storedUser);
    } else {
      setUser(null);
      clearTokens();
    }
    setIsLoading(false);
  }, []);

  // Setup 401 interceptor for token refresh
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);

      if (response.status === 401) {
        const tokens = getStoredTokens();
        // Don't try to refresh if this is already a refresh request
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (tokens?.refreshToken && !url.includes('/auth/refresh')) {
          try {
            const refreshResponse = await originalFetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: tokens.refreshToken }),
            });

            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              storeTokens({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
              });

              // Retry the original request with new token
              const newHeaders = new Headers(init?.headers);
              newHeaders.set('Authorization', `Bearer ${data.accessToken}`);
              return originalFetch(input, { ...init, headers: newHeaders });
            }
          } catch {
            // Refresh failed
          }

          // Refresh failed — clear auth state and redirect
          clearTokens();
          setUser(null);
          navigate('/login');
        } else if (!url.includes('/auth/')) {
          clearTokens();
          setUser(null);
          navigate('/login');
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [navigate]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Ungültige Anmeldedaten');
    }

    const data = await response.json();
    storeTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    const userData: User = { id: data.user.id, email: data.user.email, name: data.user.name };
    storeUser(userData);
    setUser(userData);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Registrierung fehlgeschlagen');
    }

    const data = await response.json();
    storeTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    const userData: User = { id: data.user.id, email: data.user.email, name: data.user.name };
    storeUser(userData);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
