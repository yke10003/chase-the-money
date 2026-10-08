import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';

import { deleteAccount as deleteAccountRequest, getMe, login as loginRequest, logout as logoutRequest, register as registerRequest } from '@/api/endpoints';
import type { User } from '@/api/types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; password_confirmation: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
  });

  async function login(email: string, password: string) {
    const response = await loginRequest({ email, password });
    queryClient.setQueryData(['me'], response.data);
  }

  async function register(input: { name: string; email: string; password: string; password_confirmation: string }) {
    const response = await registerRequest(input);
    queryClient.setQueryData(['me'], response.data);
  }

  function clearLocalSession() {
    queryClient.setQueryData(['me'], null);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'me',
    });
  }

  async function logout() {
    await logoutRequest();
    clearLocalSession();
  }

  async function deleteAccount(password: string) {
    await deleteAccountRequest(password);
    clearLocalSession();
  }

  const value: AuthContextValue = {
    user: me.data ?? null,
    loading: me.isLoading,
    login,
    register,
    logout,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
