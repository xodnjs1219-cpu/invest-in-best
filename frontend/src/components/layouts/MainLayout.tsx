import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CloudUpload as CloudUploadIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useLogout, useCurrentUser } from '@/hooks/queries/useAuth';
import { STORAGE_KEYS } from '@/config/constants';

interface MainLayoutProps {
  children: React.ReactNode;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  toggleTheme,
  isDarkMode = false,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<null | HTMLElement>(null);
  const { mutate: logout } = useLogout();
  const { data: currentUser } = useCurrentUser();

  const handleLogout = () => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || '';
    logout(
      { refresh_token: refreshToken },
      {
        onSuccess: () => {
          navigate('/login', { replace: true });
        },
      }
    );
  };

  const navigationItems = [
    {
      label: '대시보드',
      icon: <DashboardIcon sx={{ mr: 1 }} />,
      path: '/dashboard',
    },
    {
      label: '데이터 관리',
      icon: <CloudUploadIcon sx={{ mr: 1 }} />,
      path: '/admin/data-management',
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="sticky"
        elevation={1}
        sx={{
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
          {/* Logo */}
          <Box
            onClick={() => navigate('/dashboard')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              mr: 3,
              fontWeight: 700,
              fontSize: '1.25rem',
              color: theme.palette.primary.main,
            }}
          >
            🎓 VMC Dashboard
          </Box>

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
              {navigationItems.map((item) => (
                <Box
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2.5,
                    py: 1.25,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    color: theme.palette.text.primary,
                    fontSize: '0.9375rem',
                    fontWeight: 500,
                    '&:hover': {
                      bgcolor: theme.palette.action.hover,
                    },
                  }}
                >
                  {item.icon}
                  {item.label}
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ flex: isMobile ? 1 : 'none' }} />

          {/* Right Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* User Info */}
            {!isMobile && currentUser?.username && (
              <Box sx={{ mr: 2, textAlign: 'right' }}>
                <Box sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                  {currentUser.username}
                </Box>
                <Box sx={{ fontSize: '0.8125rem', color: theme.palette.text.secondary }}>
                  {currentUser.role === 'admin' ? '관리자' : '사용자'}
                </Box>
              </Box>
            )}

            {/* Theme Toggle */}
            {toggleTheme && (
              <Tooltip title={isDarkMode ? '라이트 모드' : '다크 모드'}>
                <IconButton
                  onClick={toggleTheme}
                  size="small"
                  sx={{
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.1)',
                    },
                  }}
                >
                  {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
            )}

            {/* User Avatar Menu */}
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: theme.palette.primary.main,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: `0 0 12px ${theme.palette.primary.main}60`,
                  },
                }}
              >
                {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            </Box>

            {/* Mobile Menu */}
            {isMobile && (
              <IconButton
                onClick={(e) => setMobileMenuOpen(e.currentTarget)}
                sx={{ ml: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* User Menu Dropdown */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {!isMobile && (
          <>
            <MenuItem disabled>
              <Box>
                <Box sx={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  {currentUser?.username}
                </Box>
                <Box sx={{ fontSize: '0.8125rem', color: theme.palette.text.secondary }}>
                  {currentUser?.role === 'admin' ? '관리자' : '사용자'}
                </Box>
              </Box>
            </MenuItem>
            <Divider />
          </>
        )}
        <MenuItem onClick={handleLogout} sx={{ color: theme.palette.error.main, fontSize: '0.9375rem' }}>
          <LogoutIcon sx={{ mr: 1, fontSize: '1.25rem' }} />
          로그아웃
        </MenuItem>
      </Menu>

      {/* Mobile Navigation Menu */}
      <Menu
        anchorEl={mobileMenuOpen}
        open={Boolean(mobileMenuOpen)}
        onClose={() => setMobileMenuOpen(null)}
      >
        {navigationItems.map((item) => (
          <MenuItem
            key={item.path}
            onClick={() => {
              navigate(item.path);
              setMobileMenuOpen(null);
            }}
          >
            {item.icon}
            {item.label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: theme.palette.error.main }}>
          <LogoutIcon sx={{ mr: 1 }} />
          로그아웃
        </MenuItem>
      </Menu>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: theme.palette.background.default,
          p: { xs: 2, sm: 2.5, md: 3 },
          maxWidth: '1400px',
          width: '100%',
          mx: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
