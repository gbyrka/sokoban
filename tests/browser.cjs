const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.SOKOBAN_URL || 'http://127.0.0.1:8766/sokoban/';
(async () => {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  const errors = [];
  const context = await browser.newContext({viewport: {width: 1280, height: 1000}});
  await context.route('https://www.googletagmanager.com/**', r => r.abort());
  let page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const press = async keys => { for (const key of keys) await page.keyboard.press(key); };
  try {
    await page.goto(url);
    assert.equal(await page.textContent('#level'), '00');
    assert.equal(await page.textContent('#targets'), '0 / 3');
    await press(['ArrowUp']);
    await page.reload();
    assert.equal(await page.textContent('#moves'), '1');
    await press(['z']); assert.equal(await page.textContent('#moves'), '0');
    await press(['y']); assert.equal(await page.textContent('#moves'), '1');
    await press(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowUp']);
    assert.equal(await page.locator('#celebration').evaluate(el => el.hidden), false);
    assert.equal(await page.locator('#win-dialog').evaluate(d => d.open), false);
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('sokoban_progress_v2')).records[0]), 'saved before animation ends');
    await page.waitForTimeout(700);
    await page.screenshot({path:'/tmp/games-preview/sokoban-victory.png', fullPage:true});
    await page.waitForFunction(() => document.getElementById('win-dialog').open);
    assert.equal(await page.locator('#celebration').evaluate(el => el.hidden), true);
    await page.screenshot({path:'/tmp/games-preview/sokoban-win-dialog.png', fullPage:true});
    await page.click('#review'); await page.keyboard.press('z'); await page.keyboard.press('y');
    assert.equal(await page.locator('#celebration').evaluate(el => el.hidden), false);
    await page.keyboard.press('z');
    await page.waitForTimeout(2300);
    assert.equal(await page.locator('#win-dialog').evaluate(d => d.open), false, 'undo cancels pending victory');
    await page.keyboard.press('y'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#win-dialog').evaluate(d => d.open), true, 'Enter skips animation');
    await page.click('#review'); await page.keyboard.press('z');
    await page.setViewportSize({width:320,height:700});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.keyboard.press('y'); await page.waitForTimeout(700);
    await page.screenshot({path:'/tmp/games-preview/sokoban-victory-mobile.png',fullPage:false});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.keyboard.press('Escape'); await page.click('#review'); await page.keyboard.press('z');
    await page.emulateMedia({reducedMotion:'reduce'}); await page.keyboard.press('y');
    assert.equal(await page.locator('#win-dialog').evaluate(d => d.open), true);
    assert.equal(await page.locator('#celebration').evaluate(el => el.hidden), true, 'reduced motion skips particles');
    await page.emulateMedia({reducedMotion:'no-preference'});
    assert.equal(await page.textContent('#pushes'), '3');
    const cookies = await context.cookies();
    const saved = cookies.find(c => c.name === 'sokoban_completed_v2');
    assert.ok(saved.expires > Date.now()/1000 + 300 * 86400, 'cookie persists well beyond a session');
    await page.click('#next'); assert.equal(await page.textContent('#level'), '01');
    await page.click('#levels'); assert.equal(await page.locator('#level-grid button').count(), 51);
    assert.ok(await page.locator('#level-grid button').first().evaluate(b => b.classList.contains('solved')));
    await page.keyboard.press('Escape');
    // New browser context, cookie only: a later visit without local storage.
    const returning = await browser.newContext();
    await returning.addCookies(cookies);
    const later = await returning.newPage(); await later.goto(url);
    await later.click('#levels');
    assert.equal(await later.textContent('#completed-count'), '1');
    assert.ok(await later.locator('#level-grid button').first().evaluate(b => b.classList.contains('solved')));
    await returning.close();
    // Original level 1 was index 0: migrate both the record and in-progress path.
    const legacyContext = await browser.newContext();
    await legacyContext.addInitScript(() => {
      localStorage.clear(); document.cookie = 'sokoban_completed_v2=; Max-Age=0; Path=/';
      localStorage.setItem('sokoban_progress_v1', JSON.stringify({version:1,index:0,records:{0:{moves:100,pushes:30}},path:['up']}));
    });
    page = await legacyContext.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); assert.equal(await page.textContent('#level'), '01');
    assert.equal(await page.textContent('#moves'), '1');
    assert.match(await page.textContent('#best'), /100 MOVES/);
    await page.click('#levels');
    assert.equal(await page.locator('#level-grid button.solved').textContent(), '01');
    await page.locator('#level-grid button').first().click();
    await page.setViewportSize({width: 390, height: 844});
    await page.locator('[data-dir=up]').click(); assert.equal(await page.textContent('#moves'), '1');
    await page.screenshot({path:'/tmp/games-preview/sokoban-mobile.png',fullPage:true});
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height:900});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    }
    await page.screenshot({path:'/tmp/games-preview/sokoban-desktop.png',fullPage:true});
    // Cookies still save completion when localStorage is disabled.
    const restricted = await browser.newContext();
    await restricted.addCookies(cookies);
    await restricted.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked');}});
    });
    const fallback = await restricted.newPage(); await fallback.goto(url); await fallback.click('#levels');
    assert.equal(await fallback.textContent('#completed-count'), '1');
    assert.match(await fallback.textContent('#storage-warning'), /saved in a cookie/);
    await restricted.close();
    const noCookies = await browser.newContext();
    await noCookies.addInitScript(() => {
      Object.defineProperty(document, 'cookie', {get() {return '';}, set() {}});
    });
    const localOnly = await noCookies.newPage(); await localOnly.goto(url);
    assert.match(await localOnly.textContent('#storage-warning'), /saved in browser storage/);
    await localOnly.keyboard.press('ArrowUp'); await localOnly.reload();
    assert.equal(await localOnly.textContent('#moves'), '1');
    await localOnly.click('#restart'); await localOnly.click('#confirm-restart');
    assert.equal(await localOnly.textContent('#moves'), '0');
    // Swipe up on the board.
    await localOnly.locator('#board').dispatchEvent('pointerdown', {pointerId: 1, button: 0, clientX: 100, clientY: 150});
    await localOnly.locator('#board').dispatchEvent('pointerup', {pointerId: 1, button: 0, clientX: 100, clientY: 100});
    assert.equal(await localOnly.textContent('#moves'), '1');
    await noCookies.close();
    const noStorage = await browser.newContext();
    await noStorage.addInitScript(() => {
      Object.defineProperty(document, 'cookie', {get() {return '';}, set() {}});
      Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked');}});
    });
    const temporary = await noStorage.newPage(); await temporary.goto(url);
    assert.match(await temporary.textContent('#storage-warning'), /Saving is unavailable/);
    await temporary.keyboard.press('ArrowUp'); assert.equal(await temporary.textContent('#moves'), '1');
    await noStorage.close();
    assert.deepEqual(errors, []);
    console.log('PASS: tutorial completion, undo/redo, reload, persistent cookie, return visit, legacy migration, touch, responsive layout, storage fallback, victory animation, cancellation, skip, reduced motion, no JS errors.');
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
