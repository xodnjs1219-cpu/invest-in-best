import { describe, it, expect } from 'vitest';
import { useLogin } from '@/hooks/queries/useAuth';

describe('useAuth Hook', () => {
  it('should have useLogin function', () => {
    expect(typeof useLogin).toBe('function');
  });
});
