import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/queries/useAuth';
import { Box, CircularProgress } from '@mui/material';

export const HomePage = () => {
  const { data: currentUser, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // 로그인되지 않으면 로그인 페이지로
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // 로그인되었으면 대시보드로
  return <Navigate to="/dashboard" replace />;
};
