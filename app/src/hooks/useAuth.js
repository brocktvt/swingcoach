import { useState, useEffect } from 'react';
import { auth } from '../services/api';

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await auth.getUser();
      setUser(u);
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const data = await auth.login(email, password);
    setUser(data.user);
    return data;
  };

  const register = async (email, password) => {
    const data = await auth.register(email, password);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
  };

  return { user, loading, login, register, logout };
}
