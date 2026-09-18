"use client";

import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext({ user: null, loading: true, loginStateLocally: () => {}, logoutLocally: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage or an endpoint (simpler: use a /api/auth/me)
  // For simplicity, we just keep state based on login success and assume a generic whoami endpoint
  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  }, []);

  const loginStateLocally = (userData) => {
    setUser(userData);
  };

  const logoutLocally = () => {
    fetch("/api/auth/logout", { method: "POST" })
      .then(() => setUser(null));
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginStateLocally, logoutLocally }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
