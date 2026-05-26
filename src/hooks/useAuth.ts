import { useAuthStore } from '@/store/authStore';
import { getFrappeApp, initializeFrappe } from '@/lib/frappe';

export const useAuth = () => {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    erpnextUrl,
    setUser, 
    setLoading, 
    setErpnextUrl, 
    logout: storeLogout 
  } = useAuthStore();

  const checkAuth = async () => {
    try {
      const frappe = getFrappeApp();
      
      const response = await frappe.call('frappe.auth.get_logged_user');
      if (response.message) {
        setUser(response.message);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string, erpnextUrl?: string) => {
    setLoading(true);
    try {
      if (erpnextUrl) {
        initializeFrappe(erpnextUrl);
        setErpnextUrl(erpnextUrl);
      }
      
      const frappe = getFrappeApp();
      await frappe.login(username, password);
      await checkAuth();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const frappe = getFrappeApp();
      await frappe.logout();
      storeLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    erpnextUrl,
    login,
    logout,
    checkAuth,
  };
};