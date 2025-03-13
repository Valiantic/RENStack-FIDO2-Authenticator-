/**
 * Debugging utilities to help troubleshoot authentication issues
 */

// Debug current auth state
export function checkCurrentAuthState() {
  const authData = {
    sessionStorage: null,
    localStorage: {
      lastAction: localStorage.getItem('last_auth_action'),
      username: localStorage.getItem('auth_username')
    },
    currentUrl: window.location.href,
    timestamp: new Date().toISOString()
  };
  
  // Try to get and parse session storage
  try {
    const storedUser = sessionStorage.getItem('authenticatedUser');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      authData.sessionStorage = {
        username: userData.username,
        displayName: userData.displayName,
        id: userData.id,
        isObj: typeof userData === 'object'
      };
    }
  } catch (e) {
    authData.sessionStorage = { error: e.message };
  }
  
  console.log('CURRENT AUTH STATE:', authData);
  return authData;
}

// Debug auth navigation
export function debugNavigation(from, to, data = {}) {
  console.log(`AUTH NAVIGATION: ${from} → ${to}`, {
    ...data,
    url: window.location.href,
    timestamp: new Date().toISOString()
  });
}
