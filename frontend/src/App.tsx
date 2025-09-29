import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  TextField, 
  Button, 
  Paper,
  Alert,
  Fab
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy'; // Chatbot-style icon
import { useNavigate } from 'react-router-dom';
import TodoList from './components/TodoList';
import TodoForm from './components/TodoForm';
import { login, logout, checkAuth, getCsrfToken } from './services/api';

interface User {
  id: number;
  username: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      await getCsrfToken();
      const userData = await checkAuth();
      setUser(userData);
    } catch (err) {
      // not logged in
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const userData = await login(username, password);
      setUser(userData);
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return <Box p={4}>Loading...</Box>;
  }

  if (!user) {
    return (
      <Container maxWidth="sm">
        <Box mt={8}>
          <Paper sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom>
              Login
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3 }}
              >
                Login
              </Button>
            </form>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box mt={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h3">
            Todo App
          </Typography>
          <Box>
            <Typography variant="body1" component="span" sx={{ mr: 2 }}>
              Welcome, {user.username}!
            </Typography>
            <Button variant="outlined" onClick={handleLogout}>
              Logout
            </Button>
          </Box>
        </Box>
        
        <TodoForm />
        <TodoList />
      </Box>

      {/* Floating Chatbot Icon */}
      <Fab 
        color="primary" 
        aria-label="chatbot"
        sx={{ 
          position: 'fixed', 
          bottom: 24, 
          right: 24, 
          zIndex: 1300 
        }}
        onClick={() => navigate('/codebot')}
      >
        <SmartToyIcon />
      </Fab>
    </Container>
  );
}

export default App;
