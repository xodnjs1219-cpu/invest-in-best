import apiClient from '@/api/client';
import type { CreateUserRequest, CreateUserResponse, UsersListResponse } from '@/types/dto/users.dto';

export const createUserApi = async (data: CreateUserRequest): Promise<CreateUserResponse> => {
  const response = await apiClient.post<CreateUserResponse>(
    '/api/users/create/',
    data
  );
  return response.data;
};

export const listUsersApi = async (): Promise<UsersListResponse> => {
  const response = await apiClient.get<UsersListResponse>(
    '/api/users/'
  );
  return response.data;
};
