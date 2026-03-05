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
  trace: '[data-testid="panel-trace"]',
  orphans: '[data-testid="panel-orphans"]',
  snapshot: '[data-testid="panel-snapshot"]',
  stepLabel: '[data-testid="step-label"]',
  rewindTimeline: '[data-testid="rewind-timeline"]',
  refreshBanner: '[data-testid="refresh-banner"]',
  valueCallout: '[data-testid="value-callout"]',
  generatedUi: '[data-testid="generated-ui"]',
  devtools: '[data-testid="devtools"]',
};

function component(id: string) {
  return `[data-continuum-id="${id}"]`;
}

async function openTab(page: Page, tabId: string) {
  await page.locator(`[data-testid="tab-${tabId}"]`).click();
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

test.describe('Scenario 1: Forward navigation preserves state', () => {
  test('state carries across key-matched id rename', async ({ page }) => {
    await page.locator(`${component('destination')} input`).fill('Lisbon, Portugal');
    await page.locator(`${component('trip_notes')} textarea`).fill('Need vegan-friendly options');

    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 2');

    await expect(page.locator(`${component('primary_destination')} input`)).toHaveValue('Lisbon, Portugal');
    await expect(page.getByTestId('value-callout').first()).toContainText('carried over');
  });
});

test.describe('Scenario 2: Type mismatch drops state', () => {
  test('select->slider type change drops state and shows type-changed diff', async ({
    page,
  }) => {
    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 2');
    await page.locator(`${component('budget')} select`).selectOption('mid');

    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 3');

    await expect(page.locator(`${component('budget')} input[type="range"]`)).toBeVisible();

    await openTab(page, 'state-diffs');
    const diffsText = await page.locator(panel.diffs).innerText();
    expect(diffsText).toContain('type-changed');

    await openTab(page, 'validation');
    const issuesText = await page.locator(panel.issues).innerText();
    expect(issuesText).toContain('TYPE_MISMATCH');
  });
});

test.describe('Scenario 3: Component removal', () => {
  test('final step removes optional fields from generated form', async ({
    page,
  }) => {
    for (let i = 0; i < 3; i++) {
      await page.locator(btn.next).click();
    }
    await expect(page.locator(panel.stepLabel)).toContainText('Step 4');
    await expect(page.locator(component('trip_notes'))).toHaveCount(0);
    await expect(page.locator(component('travel_style'))).toHaveCount(0);
  });
});

test.describe('Scenario 4: Hallucination resilience', () => {
  test('hallucination triggers issues and trace entries', async ({ page }) => {
    await page.locator(`${component('destination')} input`).fill('Test');

    await page.locator(btn.hallucinate).click();

    const traceText = await page.locator(panel.trace).innerText();
    expect(traceText.length).toBeGreaterThan(0);

    await openTab(page, 'validation');
    const issuesText = await page.locator(panel.issues).innerText();
    await openTab(page, 'state-diffs');
    const diffsText = await page.locator(panel.diffs).innerText();
    expect((issuesText + diffsText).length).toBeGreaterThan(5);
  });
});

test.describe('Scenario 5: Refresh persistence', () => {
  test('state survives page refresh via localStorage', async ({ page }) => {
    await page.locator(`${component('destination')} input`).fill('Cape Town');
    await page.locator(`${component('trip_notes')} textarea`).fill('Quiet neighborhood and local food');

    await page.reload();
    await enterPlaygroundIfPresent(page);
    await expect(page.locator(`${component('destination')} input`)).not.toHaveValue('');
  });

  test('navigated state persists across refresh', async ({ page }) => {
    await page.locator(`${component('destination')} input`).fill('Kyoto');
    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 2');

    await page.reload();
    await enterPlaygroundIfPresent(page);
    await expect(page.locator(panel.stepLabel)).toContainText('Step 1');
    await expect(page.locator(`${component('destination')} input`)).not.toHaveValue('');
  });
});

test.describe('Scenario 6: Rewind timeline', () => {
  test('rewind buttons appear after navigating steps', async ({ page }) => {
    await expect(page.locator(panel.rewindTimeline)).toBeVisible();

    await page.locator(btn.next).click();
    await page.locator(btn.next).click();

    const buttons = page.locator(`${panel.rewindTimeline} button`);
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('clicking rewind restores prior schema version', async ({ page }) => {
    await page.locator(`${component('destination')} input`).fill('Seoul');
    await page.locator(btn.next).click();
    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 3');

    await page.locator('[data-testid="rewind-0"]').click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 1');
  });
});

test.describe('Scenario 7: Layout', () => {
  test('page has generated UI and devtools', async ({ page }) => {
    await expect(page.locator(panel.generatedUi)).toBeVisible();
    await expect(page.locator(panel.devtools)).toBeVisible();
  });
});

test.describe('Scenario 8: Orphan retention', () => {
  test('removed fields move to orphan panel and restore later', async ({ page }) => {
    await page.locator('[data-testid="scenario-orphan-retention"]').click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 1');

    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 2');
    await openTab(page, 'saved-values');
    await expect(page.locator(panel.orphans)).toContainText('loyalty_number');
    await expect(page.locator(panel.orphans)).toContainText('special_requests');

    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 3');
    await expect(page.locator(`${component('loyalty_number_v2')} input`)).toHaveValue('LTY-2201');

    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 4');
    await expect(page.locator(`${component('special_requests_v3')} textarea`)).toHaveValue(
      'Late check-in near elevator'
    );
    await openTab(page, 'saved-values');
    await expect(page.locator(panel.orphans)).toContainText('No saved values');
  });
});
