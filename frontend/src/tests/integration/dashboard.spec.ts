import { test, expect } from '@playwright/test';

test.describe('AI Incident Dashboard E2E Flows', () => {
  
  test('should load incidents dashboard page and display workbench metrics', async ({ page }) => {
    // Navigate to the Vite development server port
    await page.goto('http://localhost:5173');
    
    // Check that header is rendered
    await expect(page.locator('h1')).toContainText('AI Incident Command Center');
    
    // Verify Triage workbench heading is shown
    await expect(page.locator('h2')).toContainText('Triage Workbench');
    
    // Check that incidents list table is rendered
    const listTable = page.locator('table');
    await expect(listTable).toBeVisible();
  });

  test('should navigate to incident detail page and toggle telemetry tabs', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Click on the first incident row in the table
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    
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
    
    // Check page header
    await expect(page.locator('h2')).toContainText('Agent Performance & System Health');
    
    // Check active panels status
    await expect(page.locator('text=Watchdog Status:')).toBeVisible();
    await expect(page.locator('text=Inference Latency Trend')).toBeVisible();
  });
});
