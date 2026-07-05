import type { RouteObject } from 'react-router-dom';
import { LoginPage } from '@/components/pages/LoginPage';
import { DashboardPage } from '@/components/pages/DashboardPage';
import { DataManagementPage } from '@/components/pages/DataManagementPage';
import { DetailedReportPage } from '@/components/pages/DetailedReportPage';
import { HomePage } from '@/components/pages/HomePage';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { USER_ROLES } from '@/config/constants';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Container, Typography } from '@mui/material';

const UnauthorizedPage = () => (
  <MainLayout>
    <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        접근 거부
      </Typography>
      <Typography variant="body1" color="textSecondary">
        이 페이지에 접근할 권한이 없습니다.
      </Typography>
    </Container>
  </MainLayout>
);

const NotFoundPage = () => (
  <MainLayout>
    <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        페이지를 찾을 수 없습니다
      </Typography>
      <Typography variant="body1" color="textSecondary">
        요청한 페이지가 존재하지 않습니다.
      </Typography>
    </Container>
  </MainLayout>
);

export const routes = (props: { toggleTheme: () => void; isDarkMode: boolean }): RouteObject[] => [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/login',
    element: <LoginPage toggleTheme={props.toggleTheme} isDarkMode={props.isDarkMode} />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <MainLayout toggleTheme={props.toggleTheme} isDarkMode={props.isDarkMode}>
          <DashboardPage />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/data-management',
    element: (
      <ProtectedRoute requiredRole={USER_ROLES.ADMIN}>
        <MainLayout toggleTheme={props.toggleTheme} isDarkMode={props.isDarkMode}>
          <DataManagementPage />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/reports/:reportType',
    element: (
      <ProtectedRoute>
        <MainLayout toggleTheme={props.toggleTheme} isDarkMode={props.isDarkMode}>
          <DetailedReportPage />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
