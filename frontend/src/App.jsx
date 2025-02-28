import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import { useState } from 'react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register onAuthSuccess={() => setIsAuthenticated(true)} />} />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/register" />} 
        />
        <Route path="/" element={<Navigate to="/register" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
