import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const btn = {
  prev: '[data-testid="btn-prev"]',
  next: '[data-testid="btn-next"]',
  hallucinate: '[data-testid="btn-hallucinate"]',
};

const panel = {
  diffs: '[data-testid="panel-diffs"]',
  issues: '[data-testid="panel-issues"]',
  resolutions: '[data-testid="panel-resolutions"]',
  detached: '[data-testid="panel-detached"]',
  snapshot: '[data-testid="panel-snapshot"]',
  stepLabel: '[data-testid="step-label"]',
  rewindTimeline: '[data-testid="rewind-timeline"]',
  generatedUi: '[data-testid="generated-ui"]',
  devtools: '[data-testid="devtools"]',
};

function component(id: string) {
  return `[data-continuum-id="${id}"]`;
}

async function openTab(page: Page, tabId: string) {
  const tab = page.locator(`[data-testid="tab-${tabId}"]`);
  if (!(await tab.isVisible())) {
    await page.locator('summary').filter({ hasText: 'Diagnostics' }).click();
  }
  await tab.click();
}

async function goToScenario(page: Page, scenarioId: string) {
  await page.getByTestId(`scenario-${scenarioId}`).click();
  await expect(page.locator(panel.stepLabel)).toContainText('Step 1');
}

async function advanceScenario(page: Page, maxSteps: number) {
  for (let attempts = 0; attempts < maxSteps; attempts++) {
    const nextButton = page.locator(btn.next);
    const disabled = await nextButton.isDisabled();
    if (disabled) {
      return;
    }
    await nextButton.click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step');
    await expect(page.locator(panel.generatedUi)).toBeVisible();
    await openTab(page, 'raw-snapshot');
    await expect(page.locator(panel.snapshot)).not.toContainText('No snapshot');
  }
}

async function enterPlaygroundIfPresent(page: Page) {
  await page.getByTestId('hero-enter-playground').click({ timeout: 1000 }).catch(() => undefined);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => ((globalThis as unknown) as { localStorage: { clear: () => void } }).localStorage.clear());
  await page.reload();
  await enterPlaygroundIfPresent(page);
  await expect(page.locator('h1')).toContainText('Continuum Playground');
});

test('key-based carryover survives id rename', async ({ page }) => {
  await page.locator(`${component('destination')} input`).fill('Lisbon, Portugal');
  await page.locator(`${component('trip_notes')} textarea`).fill('Need vegan-friendly options');
  await page.locator(btn.next).click();

  await expect(page.locator(panel.stepLabel)).toContainText('Step 2');
  await expect(page.locator(`${component('primary_destination')} input`)).toHaveValue('Lisbon, Portugal');
});

test('type change produces diff and validation signal', async ({ page }) => {
  await page.locator(btn.next).click();
  await expect(page.locator(panel.stepLabel)).toContainText('Step 2');
  await page.locator(`${component('budget')} select`).selectOption('mid');
  await page.locator(btn.next).click();

  await expect(page.locator(panel.stepLabel)).toContainText('Step 3');
  await expect(page.locator(`${component('budget')} input[type="range"]`)).toBeVisible();
  await openTab(page, 'state-diffs');
  await expect(page.locator(panel.diffs)).toContainText('type-changed');
  await openTab(page, 'validation');
  await expect(page.locator(panel.issues)).toContainText('TYPE_MISMATCH');
});

test('orphan retention detaches and restores values', async ({ page }) => {
  await goToScenario(page, 'orphan-retention');
  await page.locator(btn.next).click();

  await expect(page.locator(panel.stepLabel)).toContainText('Step 2');
  await openTab(page, 'saved-values');
  await expect(page.locator(panel.detached)).toContainText('loyalty_number');
  await expect(page.locator(panel.detached)).toContainText('special_requests');

  await page.locator(btn.next).click();
  await expect(page.locator(panel.stepLabel)).toContainText('Step 3');
  await expect(page.locator(`${component('loyalty_number_v2')} input`)).toHaveValue('LTY-2201');

  await page.locator(btn.next).click();
  await expect(page.locator(panel.stepLabel)).toContainText('Step 4');
  await expect(page.locator(`${component('special_requests_v3')} textarea`)).toHaveValue(
    'Late check-in near elevator'
  );
  await openTab(page, 'saved-values');
  await expect(page.locator(panel.detached)).toContainText('No saved values');
});

test('rewind timeline rewinds to earlier step', async ({ page }) => {
  await expect(page.locator(panel.rewindTimeline)).toBeVisible();
  await page.locator(btn.next).click();
  await page.locator(btn.next).click();
  await expect(page.locator(panel.stepLabel)).toContainText('Step 3');

  await page.locator('[data-testid="rewind-0"]').click();
  await expect(page.locator(panel.stepLabel)).toContainText('Step 1');
});

test('refresh preserves user-entered values', async ({ page }) => {
  await page.locator(`${component('destination')} input`).fill('Cape Town');
  await page.locator(`${component('trip_notes')} textarea`).fill('Quiet neighborhood and local food');
  await page.reload();
  await enterPlaygroundIfPresent(page);

  const destination = page.locator(`${component('destination')} input`);
  const tripNotes = page.locator(`${component('trip_notes')} textarea`);
  await expect(destination).not.toHaveValue('');
  await expect(tripNotes).toBeVisible();
});

test('scenario smoke sweep walks each scenario', async ({ page }) => {
  const scenarioIds = [
    'view-evolution',
    'deep-nesting',
    'scale-stress',
    'collection-showcase',
    'migration-strategy',
    'orphan-retention',
    'key-matching',
    'action-lifecycle',
  ];

  for (const scenarioId of scenarioIds) {
    await page.getByTestId(`scenario-${scenarioId}`).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 1');
    await expect(page.locator(panel.generatedUi)).toBeVisible();
    await openTab(page, 'narrative');
    await expect(page.locator(panel.devtools)).toBeVisible();
    await advanceScenario(page, 8);
  }
});
