import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Typography,
  Stack,
  useTheme,
  InputAdornment,
} from '@mui/material';
import { Person as PersonIcon, Lock as LockIcon } from '@mui/icons-material';
import { useLogin } from '@/hooks/queries/useAuth';

const loginSchema = z.object({
  username: z.string().min(1, '아이디를 입력해주세요').max(150),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mutate, isPending, isError, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    mutate(data, {
      onSuccess: () => {
        navigate('/dashboard');
      },
    });
  };

  return (
    <Stack spacing={2.5} component="form" onSubmit={handleSubmit(onSubmit)}>
      {/* Title */}
      <Box sx={{ textAlign: 'center', mb: 0.5 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            mb: 0.5,
            color: theme.palette.text.primary,
          }}
        >
          로그인
        </Typography>
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{ fontSize: '0.9375rem' }}
        >
          계정 정보를 입력하세요
        </Typography>
      </Box>

      {/* Error Alert */}
      {isError && (
        <Alert
          severity="error"
          sx={{
            borderRadius: 1.5,
            animation: 'slideDown 0.3s ease-out',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {error?.message || '아이디 또는 비밀번호가 일치하지 않습니다'}
          </Typography>
        </Alert>
      )}

      {/* Username Field */}
      <TextField
        {...register('username')}
        placeholder="아이디"
        fullWidth
        variant="outlined"
        error={!!errors.username}
        helperText={errors.username?.message}
        disabled={isPending}
        autoFocus
        data-testid="login-username-input"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <PersonIcon
                sx={{
                  color: theme.palette.action.active,
                  mr: 1,
                }}
              />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 1,
            transition: 'all 0.2s ease',
            '&:hover fieldset': {
              borderColor: theme.palette.primary.main,
            },
          },
        }}
      />

      {/* Password Field */}
      <TextField
        {...register('password')}
        placeholder="비밀번호"
        type="password"
        fullWidth
        variant="outlined"
        error={!!errors.password}
        helperText={errors.password?.message}
        disabled={isPending}
        data-testid="login-password-input"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LockIcon
                sx={{
                  color: theme.palette.action.active,
                  mr: 1,
                }}
              />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 1,
            transition: 'all 0.2s ease',
            '&:hover fieldset': {
              borderColor: theme.palette.primary.main,
            },
          },
        }}
      />

      {/* Submit Button */}
      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={isPending}
        data-testid="login-submit-button"
        sx={{
          py: 1.5,
          mt: 0.5,
          borderRadius: 1,
          fontWeight: 600,
          fontSize: '1rem',
          textTransform: 'none',
          boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
          transition: 'all 0.3s ease',
          '&:hover:not(:disabled)': {
            boxShadow: `0 6px 16px ${theme.palette.primary.main}50`,
            transform: 'translateY(-1px)',
          },
          '&:disabled': {
            opacity: 0.7,
          },
        }}
      >
        {isPending ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={22} color="inherit" />
            <span>로그인 중...</span>
          </Box>
        ) : (
          '로그인'
        )}
      </Button>

      {/* Divider */}
      <Box
        sx={{
          position: 'relative',
          textAlign: 'center',
          my: 1,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '1px',
            bgcolor: theme.palette.divider,
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            position: 'relative',
            bgcolor: theme.palette.background.paper,
            px: 2,
            color: theme.palette.text.secondary,
          }}
        >
          또는
        </Typography>
      </Box>

      {/* Demo Info */}
      <Box
        sx={{
          p: 2,
          borderRadius: 1.5,
          bgcolor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
          테스트 계정:
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ display: 'block' }}>
          아이디: <code style={{ fontSize: '0.9rem' }}>admin</code>
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ display: 'block' }}>
          비밀번호: <code style={{ fontSize: '0.9rem' }}>password123</code>
        </Typography>
      </Box>
    </Stack>
  );
};
