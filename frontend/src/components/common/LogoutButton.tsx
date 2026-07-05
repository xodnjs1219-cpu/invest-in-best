import { useNavigate } from 'react-router-dom';
import { useLogout } from '@/hooks/queries/useAuth';
import { STORAGE_KEYS } from '@/config/constants';
import { Button } from '@mui/material';

export const LogoutButton = () => {
  const navigate = useNavigate();
  const { mutate: logout, isPending } = useLogout();

  const handleLogout = () => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    // localStorage 토큰 먼저 삭제 (필수)
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_INFO);

    // 백엔드 로그아웃 API 호출 (에러 무관)
    if (refreshToken) {
      logout({ refresh_token: refreshToken }, {
        onSettled: () => {
          // 성공/실패 무관 로그인 페이지로 이동
          navigate('/login');
        },
      });
    } else {
      // refresh_token이 없으면 즉시 로그인 페이지로 이동
      navigate('/login');
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isPending}
      variant="outlined"
      color="inherit"
    >
      {isPending ? '로그아웃 중...' : '로그아웃'}
    </Button>
  );
};
