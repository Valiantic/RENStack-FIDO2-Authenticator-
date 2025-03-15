/**
 * Debugging utilities to help troubleshoot authentication issues
*/

// DEBUG CURRENT AUTH STATE
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
  
  // TRY TO GET USER DATA FROM SESSION STORAGE
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

// DEBUG AUTH NAVIGATION 
export function debugNavigation(from, to, data = {}) {
  console.log(`AUTH NAVIGATION: ${from} → ${to}`, {
    ...data,
    url: window.location.href,
    timestamp: new Date().toISOString()
  });
}
