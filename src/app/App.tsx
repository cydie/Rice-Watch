import { useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { ForgotPassword } from './components/ForgotPassword';
import { Layout } from './components/Layout';
import { DashboardHub } from './components/DashboardHub';
import { CropReports } from './components/CropReports';
import { FarmersData } from './components/FarmersData';
import { Administration } from './components/Administration';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    secondary: {
      main: '#66bb6a',
    },
    background: {
      default: '#f3f4f6',
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#6b7280',
    },
  },
  typography: {
    fontFamily:
      '"DM Sans", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f3f4f6',
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
  },
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
});

function AppRoutes() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'forgot-password'>('login');
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)',
        }}
      >
        <CircularProgress sx={{ color: '#fff' }} size={48} />
      </Box>
    );
  }

  const renderContent = () => {
    const isAdmin = user?.role === 'admin';
    switch (currentView) {
      case 'crop-reports':
        return <CropReports />;
      case 'farmers':
        return <FarmersData />;
      case 'admin':
        return isAdmin ? <Administration /> : <DashboardHub />;
      default:
        return <DashboardHub />;
    }
  };

  if (!isAuthenticated) {
    if (authView === 'forgot-password') {
      return <ForgotPassword onNavigateToLogin={() => setAuthView('login')} />;
    }
    return <Login onNavigateToForgotPassword={() => setAuthView('forgot-password')} />;
  }

  return (
    <Layout
      currentView={currentView}
      onNavigate={setCurrentView}
      onLogout={logout}
      userRole={user?.role || 'encoder'}
      userName={user?.fullName || 'User'}
      userEmail={user?.email || ''}
    >
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <div className="size-full min-h-screen">
          <AppRoutes />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
