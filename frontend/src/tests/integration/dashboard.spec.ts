import { test, expect } from '@playwright/test';

test.describe('AI Incident Dashboard E2E Flows', () => {
  
  test('should redirect unauthenticated users to /login and allow successful form submission', async ({ page }) => {
    // Clear localStorage to ensure fresh session
    await page.goto('http://localhost:5173/login');
    await page.evaluate(() => {
      localStorage.clear();
    });
    
    // Attempt to access dashboard - should redirect to /login
    await page.goto('http://localhost:5173/');
    await expect(page).toHaveURL(/\/login/);
    
    // Fill form fields
    await page.fill('input[type="text"]', 'John');
    await page.fill('input[type="email"]', 'john@sre-center.ai');
    await page.fill('input[type="password"]', 'my-secure-password');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Assert redirect to overview page
    await expect(page).toHaveURL(/http:\/\/localhost:5173\/?$/);
    
    // Assert user header display name
    await expect(page.locator('header')).toContainText('John');
  });

  test.describe('Authenticated User Flows', () => {
    test.beforeEach(async ({ page }) => {
      // Go to login page first to establish context
      await page.goto('http://localhost:5173/login');
      // Inject mock authentication directly to speed up E2E verification
      await page.evaluate(() => {
        localStorage.setItem('demo-auth', 'true');
        localStorage.setItem('username', 'Prakash');
      });
    });

    test('should load incidents dashboard page and display workbench metrics', async ({ page }) => {
      // Navigate to the incidents dashboard route
      await page.goto('http://localhost:5173/incidents');
      
      // Check that header is rendered with the correct branding name
      await expect(page.locator('header h1')).toContainText('AI Incident Management');
      
      // Verify Triage workbench heading is shown as h1
      await expect(page.locator('main h1')).toContainText('Triage Workbench');
      
      // Check that incidents list table is rendered
      const listTable = page.locator('table');
      await expect(listTable).toBeVisible();
    });

    test('should navigate to incident detail page and toggle telemetry tabs', async ({ page }) => {
      // Navigate directly to the incidents list containing the table
      await page.goto('http://localhost:5173/incidents');
      
      // Wait for table to load
      await expect(page.locator('tbody tr').first()).toBeVisible();

      // Change state filter to RESOLVED to show resolved incidents in the table
      await page.locator('select').nth(1).selectOption('RESOLVED');
      
      // Click on the first resolved incident row in the table
      const resolvedRow = page.locator('tbody tr', { hasText: 'resolved' }).first();
      await resolvedRow.click();
      
      // Verify navigation to details occurred by checking url path pattern
      await expect(page).toHaveURL(/\/incidents\//);
      
      // Verify tabs are available
      const metricsTab = page.getByRole('button', { name: 'Prometheus Metrics' });
      const logsTab = page.getByRole('button', { name: 'Loki Logs' });
      await expect(metricsTab).toBeVisible();
      await expect(logsTab).toBeVisible();
      
      // Toggle tabs and verify view changes
      await logsTab.click();
      const terminalConsole = page.locator('text=Loki Live Logs Console');
      await expect(terminalConsole).toBeVisible();
    });

    test('should load topology page and render graph visualizer canvas', async ({ page }) => {
      await page.goto('http://localhost:5173/topology');
      
      // Check that graph canvas component initializes
      const canvasContainer = page.locator('.vis-network');
      await expect(canvasContainer).toBeVisible();
    });

    test('should load health page and display watchdog status', async ({ page }) => {
      await page.goto('http://localhost:5173/health');
      
      // Check page header is h1 containing "Health Dashboard"
      await expect(page.locator('main h1')).toContainText('Health Dashboard');
      
      // Check active panels status
      await expect(page.locator('text=Watchdog Status:')).toBeVisible();
    });

    test('should filter incidents list by search input', async ({ page }) => {
      await page.goto('http://localhost:5173/incidents');
      
      // Wait for the table rows to load and ensure at least one is visible
      const firstRow = page.locator('tbody tr').first();
      await expect(firstRow).toBeVisible();
      
      // Wait for multiple rows to be present
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 1);

      // Get all table rows before filtering
      const rowsBefore = await page.locator('tbody tr').count();
      
      // Type a search query for a service (e.g., payment-service)
      const searchInput = page.locator('input[placeholder="Search by service name, incident ID..."]');
      await searchInput.fill('payment-service');
      
      // Wait for the rows to be filtered down
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
      
      // Verify table is filtered
      const rowsAfter = await page.locator('tbody tr').count();
      expect(rowsAfter).toBeLessThan(rowsBefore);
      expect(rowsAfter).toBe(1);
      
      // Verify row contains the searched service
      await expect(page.locator('tbody tr').first()).toContainText('payment-service');
    });
  });
});
