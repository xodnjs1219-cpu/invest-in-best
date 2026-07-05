import { test, expect } from '@playwright/test';

test('대시보드 페이지는 타이틀과 차트를 포함해야 한다', async ({ page }) => {
  // Given: 페이지로 바로 이동 (로그인 과정 없음)
  await page.goto('/dashboard');

  // When & Then: data-testid를 사용하여 안정적으로 요소 검증
  const title = page.getByTestId('dashboard-title');
  const chart = page.getByTestId('dashboard-chart-container');

  await expect(title).toContainText('대시보드');
  await expect(chart).toBeVisible();
});
