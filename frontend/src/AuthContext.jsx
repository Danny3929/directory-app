import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from './api/auth.js';
import { onSessionExpired } from './api/client.js';

const AuthContext = createContext(null);

// Holds "who is logged in" for the whole app.
//   user     null when logged out, otherwise { id, email, role }
//   loading  true until the first "who am I?" answer arrives, so a protected
//            page can wait instead of flashing the login form at a logged-in person
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On start-up ask the server who we are (the cookie decides). A 401 or a
  // network error both mean "treat as logged out"; public pages keep working.
  useEffect(() => {
    let cancelled = false;
    authApi.currentUser()
      .then((me) => { if (!cancelled) setUser(me); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // The API wrapper shouts this when a refresh failed: drop the user at once.
  useEffect(() => onSessionExpired(() => setUser(null)), []);

  const login = useCallback(async (credentials) => {
    const me = await authApi.login(credentials);
    setUser(me);
    return me;
  }, []);

  // Registering does not log in: the server sets no cookie. The form then calls login().
  const register = useCallback((details) => authApi.register(details), []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(); // the server clears the httpOnly cookies
    } finally {
      setUser(null); // even if the call failed, this browser forgets the user
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
