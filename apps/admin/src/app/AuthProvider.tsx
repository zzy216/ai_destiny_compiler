import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import { apiClient, clearAuthSession, setAuthSession } from '../api/client';

type AdminUser = {
  id: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled' | 'locked';
};

type AuthContextValue = {
  user: AdminUser | null;
  login: (input: { identifier: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: async (input) => {
      const response = await apiClient.login({
        ...input,
        deviceName: 'React 管理后台',
      });
      if (response.data.user.role !== 'admin') {
        clearAuthSession();
        throw new Error('当前账号没有管理员权限');
      }
      setAuthSession({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });
      setUser(response.data.user);
    },
    logout: () => {
      clearAuthSession();
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
