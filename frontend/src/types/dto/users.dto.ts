export interface CreateUserRequest {
  username: string;
  password: string;
  full_name: string;
  role: 'admin' | 'user';
}

export interface UserInfo {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
}

export interface CreateUserResponse {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

export interface UsersListResponse {
  users: UserInfo[];
  total: number;
}
