import { test, expect } from '@playwright/test';

const btn = {
  prev: '[data-testid="btn-prev"]',
  next: '[data-testid="btn-next"]',
  hallucinate: '[data-testid="btn-hallucinate"]',
};

const panel = {
  diffs: '[data-testid="panel-diffs"]',
  issues: '[data-testid="panel-issues"]',
  trace: '[data-testid="panel-trace"]',
  snapshot: '[data-testid="panel-snapshot"]',
  stepLabel: '[data-testid="step-label"]',
  rewindTimeline: '[data-testid="rewind-timeline"]',
  refreshBanner: '[data-testid="refresh-banner"]',
  generatedUi: '[data-testid="generated-ui"]',
  devtools: '[data-testid="devtools"]',
};

function component(id: string) {
  return `[data-continuum-id="${id}"]`;
}

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Continuum');
});

test.describe('Scenario 1: Forward navigation preserves state', () => {
  test('state carries across key-matched id rename', async ({ page }) => {
    await page.locator(`${component('first_name')} input`).fill('Bryton');
    await page.locator(`${component('last_name')} input`).fill('Cooper');
    await page.locator(`${component('agree_terms')} input[type="checkbox"]`).check();

    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 2');

    await expect(
      page.locator(`${component('given_name')} input`)
    ).toHaveValue('Bryton');
    await expect(
      page.locator(`${component('last_name')} input`)
    ).toHaveValue('Cooper');
    await expect(
      page.locator(`${component('agree_terms')} input[type="checkbox"]`)
    ).toBeChecked();
  });
});

test.describe('Scenario 2: Type mismatch drops state', () => {
  test('input->select type change drops state and shows type-changed diff', async ({
    page,
  }) => {
    await page.locator(`${component('first_name')} input`).fill('Test');
    await page.locator(`${component('agree_terms')} input[type="checkbox"]`).check();

    for (let i = 0; i < 3; i++) {
      await page.locator(btn.next).click();
    }
    await expect(page.locator(panel.stepLabel)).toContainText('Step 4');

    await expect(page.locator(`${component('loan_amount')} select`)).toBeVisible();

    const diffsText = await page.locator(panel.diffs).innerText();
    expect(diffsText).toContain('type-changed');

    const issuesText = await page.locator(panel.issues).innerText();
    expect(issuesText).toContain('TYPE_MISMATCH');
  });
});

test.describe('Scenario 3: Component removal', () => {
  test('removed components generate COMPONENT_REMOVED warnings', async ({
    page,
  }) => {
    for (let i = 0; i < 4; i++) {
      await page.locator(btn.next).click();
    }
    await expect(page.locator(panel.stepLabel)).toContainText('Step 5');

    const issuesText = await page.locator(panel.issues).innerText();
    expect(issuesText).toContain('COMPONENT_REMOVED');
  });
});

test.describe('Scenario 4: Hallucination resilience', () => {
  test('hallucination triggers issues and trace entries', async ({ page }) => {
    await page.locator(`${component('first_name')} input`).fill('Test');

    await page.locator(btn.hallucinate).click();

    const traceText = await page.locator(panel.trace).innerText();
    expect(traceText.length).toBeGreaterThan(0);

    const issuesOrDiffs =
      (await page.locator(panel.issues).innerText()) +
      (await page.locator(panel.diffs).innerText());
    expect(issuesOrDiffs.length).toBeGreaterThan(20);
  });
});

test.describe('Scenario 5: Refresh persistence', () => {
  test('state survives page refresh via localStorage', async ({ page }) => {
    await page.locator(`${component('first_name')} input`).fill('Bryton');
    await page.locator(`${component('last_name')} input`).fill('Cooper');
    await page.locator(`${component('email')} input`).fill('bryton@test.com');
    await page.locator(`${component('agree_terms')} input[type="checkbox"]`).check();

    await page.reload();

    await expect(page.locator(panel.refreshBanner)).toBeVisible();
    await expect(
      page.locator(`${component('first_name')} input`)
    ).toHaveValue('Bryton');
    await expect(
      page.locator(`${component('last_name')} input`)
    ).toHaveValue('Cooper');
    await expect(
      page.locator(`${component('email')} input`)
    ).toHaveValue('bryton@test.com');
    await expect(
      page.locator(`${component('agree_terms')} input[type="checkbox"]`)
    ).toBeChecked();
  });

  test('navigated state persists across refresh', async ({ page }) => {
    await page.locator(`${component('first_name')} input`).fill('Bryton');
    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 2');

    await page.reload();

    await expect(page.locator(panel.refreshBanner)).toBeVisible();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 2');
    await expect(
      page.locator(`${component('given_name')} input`)
    ).toHaveValue('Bryton');
  });
});

test.describe('Scenario 6: Rewind timeline', () => {
  test('rewind buttons appear after navigating steps', async ({ page }) => {
    await expect(page.locator(panel.rewindTimeline)).toBeVisible();

    await page.locator(btn.next).click();
    await page.locator(btn.next).click();

    const buttons = page.locator(`${panel.rewindTimeline} button`);
    await expect(buttons).toHaveCount(3);
  });

  test('clicking rewind restores prior schema version', async ({ page }) => {
    await page.locator(`${component('first_name')} input`).fill('Bryton');
    await page.locator(btn.next).click();
    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 3');

    await page.locator('[data-testid="rewind-0"]').click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 1');
  });
});

test.describe('Scenario 7: Split-panel layout', () => {
  test('page has generated UI and dev tools panels', async ({ page }) => {
    await expect(page.locator(panel.generatedUi)).toBeVisible();
    await expect(page.locator(panel.devtools)).toBeVisible();
  });
});
