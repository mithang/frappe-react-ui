import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getFrappeApp, initializeFrappe, STORAGE_KEY_URL } from '@/lib/frappe';
import { discoverAndInstallExtensions } from '@/core/registry/discoverExtensions';

interface User {
  name: string;
  email: string;
  full_name: string;
  user_image?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  erpnextUrl: string;
  login: (username: string, password: string, erpnextUrl?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [erpnextUrl, setErpnextUrl] = useState<string>(() => {
    // No public-demo-server default (that let a misconfigured build silently post real
    // credentials to a server nobody chose) — get stored URL on initial load, or empty.
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_URL) || '';
    }
    return '';
  });

  const checkAuth = async () => {
    try {
      const frappe = getFrappeApp();

      // Check if there's a stored session
      if (!frappe.hasStoredSession()) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Try to get current user info from server
      const currentUser = await frappe.getCurrentUser();

      if (currentUser && currentUser !== 'Guest') {
        // Fetch full user details
        try {
          const response = await frappe.call('frappe.client.get', {
            doctype: 'User',
            name: currentUser,
          });
          if (response.message) {
            setUser({
              name: response.message.name,
              email: response.message.email,
              full_name: response.message.full_name || response.message.name,
              user_image: response.message.user_image,
            });
          } else {
            setUser({
              name: currentUser,
              email: currentUser,
              full_name: currentUser,
            });
          }
        } catch {
          // Fallback to basic user info
          setUser({
            name: currentUser,
            email: currentUser,
            full_name: currentUser,
          });
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string, newErpnextUrl?: string) => {
    setIsLoading(true);
    try {
      // Initialize Frappe with the provided URL if given
      if (newErpnextUrl) {
        initializeFrappe(newErpnextUrl);
        setErpnextUrl(newErpnextUrl);
      }

      const frappe = getFrappeApp();
      await frappe.login(username, password);
      await checkAuth();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const frappe = getFrappeApp();
      await frappe.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      // Non-negotiable: without this, the next user to log in on this device sees whatever
      // documents/lists TanStack Query still has cached from the previous session.
      queryClient.clear();
    }
  };

  useEffect(() => {
    // Check for existing session on startup
    checkAuth();
  }, []);

  // Extension discovery (3C) needs an authenticated session — its RPCs (e.g.
  // frappe.utils.change_log.get_versions) aren't guest-accessible, and calling it at raw app
  // boot (before login) 403s every time. Runs once per successful session, not on every re-render.
  const extensionsDiscoveredRef = useRef(false);
  useEffect(() => {
    if (user && !extensionsDiscoveredRef.current) {
      extensionsDiscoveredRef.current = true;
      discoverAndInstallExtensions();
    }
    if (!user) {
      extensionsDiscoveredRef.current = false;
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    erpnextUrl,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};