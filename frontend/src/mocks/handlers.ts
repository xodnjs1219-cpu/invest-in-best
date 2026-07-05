import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/constants';

export const handlers = [
  // Login endpoint
  http.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`, async ({ request }) => {
    const body = await request.json() as { username: string; password: string };

    // Mock validation
    if (!body.username || !body.password) {
      return HttpResponse.json(
        { detail: '아이디 또는 비밀번호가 필요합니다' },
        { status: 400 }
      );
    }

    // Mock successful login
    if (body.username === 'admin_user' && body.password === 'SecurePassword123!') {
      return HttpResponse.json({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        user: {
          id: 1,
          username: 'admin_user',
          full_name: 'Admin User',
          role: 'admin',
        },
      });
    }

    // Mock inactive user
    if (body.username === 'inactive_user') {
      return HttpResponse.json(
        { detail: '비활성된 계정입니다' },
        { status: 400 }
      );
    }

    // Mock locked user
    if (body.username === 'locked_user') {
      return HttpResponse.json(
        { detail: '계정이 잠겨있습니다' },
        { status: 423 }
      );
    }

    // Mock authentication failure
    return HttpResponse.json(
      { detail: '아이디 또는 비밀번호가 일치하지 않습니다' },
      { status: 401 }
    );
  }),
];
