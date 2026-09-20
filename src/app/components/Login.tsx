import { useState } from 'react';
import {
  TextField,
  Button,
  Paper,
  Typography,
  Box,
  Alert,
  Link,
  InputAdornment,
  IconButton,
  Collapse,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import DALogo from '../../imports/D.A_logo.png';
import RiceWatchLogo from '../../imports/RiceWatch_logo.png';
import { useAuth, ApiError } from '../context/AuthContext';

interface LoginProps {
  onNavigateToForgotPassword: () => void;
}

export function Login({ onNavigateToForgotPassword }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password, rememberMe);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'API is not running. In the project folder run: npm run dev (starts web + API)'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)',
        p: { xs: 2, sm: 3 },
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: { xs: 3, sm: 4 },
          maxWidth: 450,
          width: '100%',
          borderRadius: 3,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <img src={DALogo} alt="DA Logo" style={{ height: 56 }} />
            <img src={RiceWatchLogo} alt="RiceWatch Logo" style={{ height: 56 }} />
          </Box>
          <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
            RiceWatch
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rice-Based Area Monitoring & Analysis System
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Department of Agriculture
          </Typography>
        </Box>

        <Collapse in={!!error}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Collapse>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email or Username"
            variant="outlined"
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
          />

          <TextField
            fullWidth
            label="Password"
            variant="outlined"
            margin="normal"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label="toggle password">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 1,
              mb: 2,
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              <label htmlFor="remember" style={{ fontSize: '0.875rem' }}>
                Remember me
              </label>
            </Box>
            <Link
              component="button"
              variant="body2"
              type="button"
              onClick={onNavigateToForgotPassword}
              sx={{ textDecoration: 'none' }}
            >
              Forgot Password?
            </Link>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={submitting}
            sx={{
              mt: 2,
              mb: 2,
              py: 1.5,
              background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)',
            }}
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
