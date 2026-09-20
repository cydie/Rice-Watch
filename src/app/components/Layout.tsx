import { useState, ReactNode, useEffect } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  useMediaQuery,
  useTheme,
  ListItemSecondaryAction,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Agriculture,
  Yard,
  Grass,
  LocationCity,
  Assessment,
  People,
  Notifications,
  Settings,
  Logout,
  Person,
  Description,
  Map as MapIcon,
  TrendingUp,
  WarningAmber,
} from '@mui/icons-material';
import RiceWatchLogo from '../../imports/RiceWatch_logo.png';
import { api, NotificationApi } from '../lib/api';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  userRole: string;
  userName: string;
  userEmail: string;
}

const DRAWER_WIDTH = 260;

export function Layout({
  children,
  currentView,
  onNavigate,
  onLogout,
  userRole,
  userName,
  userEmail,
}: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<NotificationApi[]>([]);
  const [snack, setSnack] = useState('');

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, view: 'dashboard' },
    { text: 'Planting Reports', icon: <Agriculture />, view: 'planting' },
    { text: 'Harvest Reports', icon: <Yard />, view: 'harvest' },
    { text: 'Standing Crop', icon: <Grass />, view: 'standing-crop' },
    { text: 'Paper Reports', icon: <Description />, view: 'papers' },
    { text: 'Municipal Map', icon: <MapIcon />, view: 'map' },
    { text: 'Yield Forecast', icon: <TrendingUp />, view: 'forecast' },
    { text: 'Early Warnings', icon: <WarningAmber />, view: 'alerts' },
    { text: 'Farmers Data', icon: <People />, view: 'farmers' },
    { text: 'User Management', icon: <Person />, view: 'users', adminOnly: true },
    { text: 'Barangay Management', icon: <LocationCity />, view: 'municipality', adminOnly: true },
    { text: 'Analytics & Reports', icon: <Assessment />, view: 'analytics' },
  ];

  const roleLabel =
    userRole === 'admin'
      ? 'Department Head'
      : userRole === 'technician'
        ? 'Technician'
        : userRole === 'encoder'
          ? 'Municipal Encoder'
          : 'User';

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    api.getNotifications().then(setNotifications).catch(() => {});
  }, []);

  const handleNavigate = (view: string) => {
    onNavigate(view);
    if (isMobile) setMobileOpen(false);
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setSnack('All notifications marked as read');
  };

  const drawerContent = (
    <Box sx={{ overflow: 'auto', mt: 1 }}>
      <List>
        {menuItems.map((item) => {
          if (item.adminOnly && userRole !== 'admin') return null;
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={currentView === item.view}
                onClick={() => handleNavigate(item.view)}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: '#e8f5e9',
                    borderRight: '4px solid #4caf50',
                  },
                }}
              >
                <ListItemIcon sx={{ color: currentView === item.view ? '#4caf50' : 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  const drawerWidth = isMobile ? DRAWER_WIDTH : desktopOpen ? DRAWER_WIDTH : 72;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          background: 'linear-gradient(90deg, #2e7d32 0%, #388e3c 100%)',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            color="inherit"
            onClick={() => (isMobile ? setMobileOpen(!mobileOpen) : setDesktopOpen(!desktopOpen))}
            edge="start"
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, minWidth: 0 }}>
            <img src={RiceWatchLogo} alt="RiceWatch" style={{ height: 36 }} />
            <Box sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="h6" noWrap fontWeight="bold">
                RiceWatch
              </Typography>
              <Typography variant="caption" noWrap display="block">
                Department of Agriculture - Rizal, Palawan
              </Typography>
            </Box>
          </Box>

          <IconButton color="inherit" onClick={(e) => setNotifAnchor(e.currentTarget)} aria-label="notifications">
            <Badge badgeContent={unreadCount} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }} aria-label="profile">
            <Avatar sx={{ bgcolor: '#1b5e20', width: 36, height: 36 }}>
              <Person />
            </Avatar>
          </IconButton>

          <Menu anchorEl={notifAnchor} open={Boolean(notifAnchor)} onClose={() => setNotifAnchor(null)}>
            <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 280 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                Notifications
              </Typography>
              {unreadCount > 0 && (
                <Typography
                  component="button"
                  variant="caption"
                  onClick={handleMarkAllRead}
                  sx={{ border: 0, background: 'none', color: 'primary.main', cursor: 'pointer' }}
                >
                  Mark all read
                </Typography>
              )}
            </Box>
            <Divider />
            {notifications.length === 0 ? (
              <MenuItem disabled>No notifications</MenuItem>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <MenuItem key={n.id} dense>
                  <Box>
                    <Typography variant="body2" fontWeight={n.read ? 400 : 600}>
                      {n.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {n.message}
                    </Typography>
                  </Box>
                </MenuItem>
              ))
            )}
          </Menu>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {userName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {roleLabel} · {userEmail}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => setSnack('Profile settings — coming in next release')}>
              <ListItemIcon>
                <Person fontSize="small" />
              </ListItemIcon>
              Profile Settings
            </MenuItem>
            <MenuItem onClick={() => setSnack('System settings — coming in next release')}>
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              System Settings
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                onLogout();
              }}
            >
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            transition: theme.transitions.create('width'),
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              transition: theme.transitions.create('width'),
              overflowX: 'hidden',
            },
          }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: '#f3f4f6',
          minHeight: '100vh',
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Box sx={{ p: 0 }}>{children}</Box>
      </Box>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setSnack('')}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  );
}
