import { test, expect } from '@playwright/test';

const btn = {
  prev: '[data-testid="btn-prev"]',
  next: '[data-testid="btn-next"]',
  hallucinate: '[data-testid="btn-hallucinate"]',
  copyHistory: '[data-testid="btn-copy-history"]',
};

const panel = {
  diffs: '[data-testid="panel-diffs"]',
  issues: '[data-testid="panel-issues"]',
  trace: '[data-testid="panel-trace"]',
  history: '[data-testid="panel-history"]',
  stepLabel: '[data-testid="step-label"]',
};

function component(id: string) {
  return `[data-continuum-id="${id}"]`;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Continuum Playground');
});

test.describe('Scenario 1: Forward navigation preserves state', () => {
  test('state carries across key-matched id rename', async ({ page }) => {
    await page.locator(`${component('name')} input`).fill('Bryton Cooper');
    await page.locator(`${component('subscribe')} input[type="checkbox"]`).check();

    await page.locator(btn.next).click();
    await expect(page.locator(panel.stepLabel)).toContainText('Step 2');

    await expect(
      page.locator(`${component('full_name')} input`)
    ).toHaveValue('Bryton Cooper');
    await expect(
      page.locator(`${component('subscribe')} input[type="checkbox"]`)
    ).toBeChecked();
  });
});

test.describe('Scenario 2: Type mismatch drops state', () => {
  test('input->select type change drops state and shows type-changed diff', async ({
    page,
  }) => {
    await page.locator(`${component('name')} input`).fill('Test');
    await page.locator(`${component('subscribe')} input[type="checkbox"]`).check();

    for (let i = 0; i < 3; i++) {
      await page.locator(btn.next).click();
    }
    await expect(page.locator(panel.stepLabel)).toContainText('Step 4');

    await expect(page.locator(`${component('full_name')} select`)).toBeVisible();
    await expect(
      page.locator(`${component('full_name')} select`)
    ).toHaveValue('');

    const diffsText = await page.locator(panel.diffs).innerText();
    expect(diffsText).toContain('type-changed');

    const issuesText = await page.locator(panel.issues).innerText();
    expect(issuesText).toContain('TYPE_MISMATCH');
  });
});

test.describe('Scenario 3: Backward navigation after state loss', () => {
  test('state lost at step 5 cannot be recovered by navigating back', async ({
    page,
  }) => {
    await page.locator(`${component('name')} input`).fill('Bryton Cooper');
    await page.locator(`${component('subscribe')} input[type="checkbox"]`).check();

    for (let i = 0; i < 4; i++) {
      await page.locator(btn.next).click();
    }
    await expect(page.locator(panel.stepLabel)).toContainText('Step 5');

    for (let i = 0; i < 4; i++) {
      await page.locator(btn.prev).click();
    }
    await expect(page.locator(panel.stepLabel)).toContainText('Step 1');

    await expect(page.locator(`${component('name')} input`)).toHaveValue('');
  });
});

test.describe('Scenario 4: Hallucination resilience', () => {
  test('hallucination triggers issues and trace entries', async ({ page }) => {
    await page.locator(`${component('name')} input`).fill('Test');

    await page.locator(btn.hallucinate).click();

    const traceText = await page.locator(panel.trace).innerText();
    expect(traceText.length).toBeGreaterThan(0);

    const issuesOrDiffs =
      (await page.locator(panel.issues).innerText()) +
      (await page.locator(panel.diffs).innerText());
    expect(issuesOrDiffs.length).toBeGreaterThan(20);
  });
});

test.describe('Scenario 5: History panel accuracy', () => {
  test('history records correct number of entries after navigation', async ({
    page,
  }) => {
    await page.locator(`${component('name')} input`).fill('Test');

    await page.locator(btn.next).click();
    await page.locator(btn.next).click();

    const historyPanel = page.locator(panel.history);
    const historyText = await historyPanel.innerText();

    expect(historyText).toContain('init');
    expect(historyText).toContain('step 1->2');
    expect(historyText).toContain('step 2->3');
    expect(historyText).toContain('interaction');
  });

  test('copy history button produces valid JSON', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.locator(btn.next).click();

    await page.locator(btn.copyHistory).click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    const parsed = JSON.parse(clipboardText);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(2);
    expect(parsed[0].action).toBe('init');
  });
});
