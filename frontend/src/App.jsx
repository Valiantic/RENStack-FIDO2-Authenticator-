import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { useState } from 'react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);

  const handleAuthSuccess = (user) => {
    setIsAuthenticated(true);
    setUserData(user);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register onAuthSuccess={handleAuthSuccess} />} />
        <Route path="/login" element={<Login onAuthSuccess={handleAuthSuccess} />} />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard user={userData} /> : <Navigate to="/login" />} 
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
