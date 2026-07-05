export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserInfo {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserInfo;
}

export interface RefreshRequest {
  refresh: string;
}

export interface RefreshResponse {
  access: string;
}

export interface LogoutRequest {
  refresh_token: string;
}
