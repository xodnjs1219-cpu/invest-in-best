import { test, expect } from '@playwright/test';

/**
 * E2E tests for login flow using Playwright (RED phase - Tests come first)
 */

test.describe('Login Flow - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    /**
     * Before each test: Navigate to login page
     */
    await page.goto('/login');
  });

  test('should successfully login with valid credentials and redirect to dashboard', async ({ page }) => {
    /**
     * Given: User is on login page
     * When: User enters valid admin credentials and submits form
     * Then: Should redirect to /admin/data-management page
     * And: Should display dashboard content
     */

    // Fill in form
    await page.fill('input[name="username"]', 'admin_user');
    await page.fill('input[name="password"]', 'SecurePassword123!');

    // Click login button
    await page.click('button:has-text("로그인")');

    // Wait for navigation to dashboard
    await page.waitForURL('/admin/data-management');

    // Verify dashboard is displayed
    expect(page.url()).toContain('/admin/data-management');
  });

  test('should successfully login regular user and redirect to dashboard', async ({ page }) => {
    /**
     * Given: User is on login page
     * When: User enters valid regular user credentials
     * Then: Should redirect to /dashboard
     */

    // Fill in form
    await page.fill('input[name="username"]', 'regular_user');
    await page.fill('input[name="password"]', 'password');

    // Click login button
    await page.click('button:has-text("로그인")');

    // Wait for navigation
    await page.waitForURL('/dashboard');

    // Verify correct redirect
    expect(page.url()).toContain('/dashboard');
  });

  test('should display error message with invalid credentials', async ({ page }) => {
    /**
     * Given: User is on login page
     * When: User enters invalid credentials and submits form
     * Then: Should display error message
     * And: Should stay on /login page
     */

    // Fill in with wrong credentials
    await page.fill('input[name="username"]', 'admin_user');
    await page.fill('input[name="password"]', 'WrongPassword');

    // Click login button
    await page.click('button:has-text("로그인")');

    // Should stay on login page
    expect(page.url()).toContain('/login');

    // Should show error message
    await expect(page.locator('text=일치하지 않습니다')).toBeVisible();
  });

  test('should display validation error when username is empty', async ({ page }) => {
    /**
     * Given: User is on login page
     * When: User submits form without entering username
     * Then: Should display "아이디를 입력해주세요" validation error
     */

    // Fill only password
    await page.fill('input[name="password"]', 'password');

    // Click login button
    await page.click('button:has-text("로그인")');

    // Should display validation error
    await expect(page.locator('text=아이디를 입력해주세요')).toBeVisible();

    // Should stay on login page
    expect(page.url()).toContain('/login');
  });

  test('should display validation error when password is empty', async ({ page }) => {
    /**
     * Given: User is on login page
     * When: User submits form without entering password
     * Then: Should display "비밀번호를 입력해주세요" validation error
     */

    // Fill only username
    await page.fill('input[name="username"]', 'admin_user');

    // Click login button
    await page.click('button:has-text("로그인")');

    // Should display validation error
    await expect(page.locator('text=비밀번호를 입력해주세요')).toBeVisible();

    // Should stay on login page
    expect(page.url()).toContain('/login');
  });

  test('should display error when account is inactive', async ({ page }) => {
    /**
     * Given: User is on login page
     * When: User logs in with inactive account credentials
     * Then: Should display "비활성된 계정입니다" error
     */

    // Fill in inactive user credentials
    await page.fill('input[name="username"]', 'inactive_user');
    await page.fill('input[name="password"]', 'password');

    // Click login button
    await page.click('button:has-text("로그인")');

    // Should display error message
    await expect(page.locator('text=비활성된 계정입니다')).toBeVisible();

    // Should stay on login page
    expect(page.url()).toContain('/login');
  });

  test('should display error when account is locked', async ({ page }) => {
    /**
     * Given: User is on login page
     * When: User logs in with locked account credentials
     * Then: Should display "계정이 잠겨있습니다" error
     */

    // Fill in locked user credentials
    await page.fill('input[name="username"]', 'locked_user');
    await page.fill('input[name="password"]', 'password');

    // Click login button
    await page.click('button:has-text("로그인")');

    // Should display error message
    await expect(page.locator('text=계정이 잠겨있습니다')).toBeVisible();

    // Should stay on login page
    expect(page.url()).toContain('/login');
  });

  test('should show loading state while login is processing', async ({ page }) => {
    /**
     * Given: User is on login page
     * When: User submits login form
     * Then: Should show "로그인 중..." text during processing
     * And: Submit button should be disabled
     */

    // Fill in form
    await page.fill('input[name="username"]', 'admin_user');
    await page.fill('input[name="password"]', 'SecurePassword123!');

    // Click login button
    const loginButton = page.locator('button:has-text("로그인")');
    await loginButton.click();

    // Should show loading state
    await expect(page.locator('text=로그인 중')).toBeVisible();

    // Button should be disabled
    await expect(loginButton).toBeDisabled();
  });

  test('should persist login session after page reload', async ({ page }) => {
    /**
     * Given: User is logged in
     * When: User reloads the page
     * Then: Should remain logged in (not redirect to /login)
     * And: Should stay on dashboard
     */

    // Login first
    await page.fill('input[name="username"]', 'admin_user');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button:has-text("로그인")');

    // Wait for navigation
    await page.waitForURL('/admin/data-management');

    // Reload page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    expect(page.url()).toContain('/admin/data-management');
  });

  test('should redirect to login when accessing protected route without authentication', async ({ page }) => {
    /**
     * Given: User is not logged in
     * When: User tries to access /dashboard directly
     * Then: Should redirect to /login page
     */

    // Navigate directly to dashboard
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('/login');

    expect(page.url()).toContain('/login');
  });
});
