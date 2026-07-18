const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5173/color-match');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // click start game
    await page.click('text=Start Game (Enter)');

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'colormatch_play.png' });

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
