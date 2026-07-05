import apiClient from '@/api/client';
import { API_ENDPOINTS } from '@/config/constants';
import type { LoginRequest, LoginResponse, RefreshRequest, RefreshResponse, LogoutRequest, UserInfo } from '@/types/dto/auth.dto';

export const loginApi = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(
    API_ENDPOINTS.AUTH.LOGIN,
    data
  );
  return response.data;
};

export const refreshTokenApi = async (data: RefreshRequest): Promise<RefreshResponse> => {
  const response = await apiClient.post<RefreshResponse>(
    API_ENDPOINTS.AUTH.REFRESH,
    data
  );
  return response.data;
};

export const logoutApi = async (data: LogoutRequest): Promise<void> => {
  await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT, data);
};

export const getCurrentUserApi = async (): Promise<UserInfo> => {
  const response = await apiClient.get<UserInfo>(
    `${API_ENDPOINTS.AUTH.LOGIN.split('login')[0]}me/`
  );
  return response.data;
};
