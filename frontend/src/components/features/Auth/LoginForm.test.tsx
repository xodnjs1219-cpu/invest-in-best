import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>
  );
};

describe('LoginForm Component - Basic Smoke Test', () => {
  it('should render login form', () => {
    render(<LoginForm />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /로그인/i })).toBeInTheDocument();
  });
});
