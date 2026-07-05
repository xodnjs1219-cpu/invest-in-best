import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUserApi, listUsersApi } from '@/api/endpoints/users.api';
import type { CreateUserRequest, CreateUserResponse, UsersListResponse } from '@/types/dto/users.dto';

/**
 * 사용자 생성 mutation 훅
 * 성공 시 사용자 목록 캐시 무효화
 */
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateUserResponse, Error, CreateUserRequest>({
    mutationFn: createUserApi,
    onSuccess: () => {
      // 사용자 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

/**
 * 사용자 목록 조회 훅
 */
export const useUsers = () => {
  return useQuery<UsersListResponse, Error>({
    queryKey: ['users'],
    queryFn: listUsersApi,
  });
};
