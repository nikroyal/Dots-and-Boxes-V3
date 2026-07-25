const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: { dir: '/home/jules/verification/videos/' }
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173/higher-or-lower');
    await page.waitForTimeout(1500);

    // Press Start (Enter)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Press Higher (ArrowUp)
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(1000);

    // Press Lower (ArrowDown)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1000);

    // Attempt multiple guesses to likely trigger a win/loss result
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(1000);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: '/home/jules/verification/screenshots/higher_lower.png' });
    await page.waitForTimeout(2000);
  } finally {
    await context.close();
    await browser.close();
  }
})();
