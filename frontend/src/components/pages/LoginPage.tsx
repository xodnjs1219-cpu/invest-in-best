import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  useTheme,
  IconButton,
  Stack,
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from '@mui/icons-material';
import { useCurrentUser } from '@/hooks/queries/useAuth';
import { LoginForm } from '@/components/features/Auth/LoginForm';

interface LoginPageProps {
  toggleTheme?: () => void;
  isDarkMode?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  toggleTheme,
  isDarkMode = false,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: currentUser } = useCurrentUser();

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  if (currentUser) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.default,
      }}
    >
      {/* Header with Theme Toggle */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: theme.palette.primary.main,
          }}
        >
          🎓 VMC Dashboard
        </Typography>
        {toggleTheme && (
          <IconButton
            onClick={toggleTheme}
            size="small"
            title={isDarkMode ? '라이트 모드' : '다크 모드'}
            sx={{
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.1)',
              },
            }}
          >
            {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        )}
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
          px: 2,
        }}
      >
        <Container maxWidth="sm">
          <Stack spacing={3}>
            {/* Welcome Section */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  mb: 1.5,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                환영합니다
              </Typography>
              <Typography
                variant="body1"
                color="textSecondary"
                sx={{ fontSize: '1rem' }}
              >
                대학 통합 데이터 대시보드에 로그인하세요
              </Typography>
            </Box>

            {/* Login Form Card */}
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: `0 12px 24px ${
                    isDarkMode
                      ? 'rgba(0,0,0,0.4)'
                      : 'rgba(0,0,0,0.08)'
                  }`,
                },
              }}
            >
              <LoginForm />
            </Paper>

            {/* Footer Info */}
            <Box
              sx={{
                textAlign: 'center',
                pt: 2,
                borderTop: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" color="textSecondary">
                이 시스템은 권한을 가진 사용자만 접근할 수 있습니다.
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          py: 2,
          px: 3,
          textAlign: 'center',
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.secondary,
          fontSize: '0.9375rem',
        }}
      >
        © 2024 대학교 데이터 대시보드. All rights reserved.
      </Box>
    </Box>
  );
};
