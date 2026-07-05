import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loginApi, logoutApi, getCurrentUserApi } from '@/api/endpoints/auth.api';
import { STORAGE_KEYS } from '@/config/constants';
import type { LoginRequest, LoginResponse, UserInfo, LogoutRequest } from '@/types/dto/auth.dto';

/**
 * 로그인 mutation 훅
 * Access Token과 Refresh Token을 localStorage에 저장
 */
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: loginApi,
    onSuccess: (data) => {
      // localStorage에 토큰과 사용자 정보 저장
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
      localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(data.user));

      // Query cache 무효화
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['isAuthenticated'] });
    },
  });
};

/**
 * 로그아웃 mutation 훅
 * localStorage에서 인증 정보 제거
 */
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, LogoutRequest>({
    mutationFn: logoutApi,
    onSuccess: () => {
      // localStorage에서 인증 정보 삭제
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_INFO);

      // Query cache 무효화
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['isAuthenticated'] });
    },
  });
};

/**
 * 현재 사용자 정보 조회 훅
 * 백엔드 API에서 현재 사용자 정보를 조회
 * 토큰이 유효하면 사용자 정보 반환, 유효하지 않으면 null 반환
 */
export const useCurrentUser = () => {
  return useQuery<UserInfo | null>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (!accessToken) {
          return null;
        }
        return await getCurrentUserApi();
      } catch (error) {
        // 토큰이 유효하지 않으면 null 반환
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5분
    retry: false,
  });
};

/**
 * 사용자가 로그인되어 있는지 확인하는 훅
 * Access Token 존재 여부로 판단
 */
export const useIsAuthenticated = () => {
  return useQuery<boolean>({
    queryKey: ['isAuthenticated'],
    queryFn: () => {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      return !!accessToken;
    },
    staleTime: Infinity,
  });
};
