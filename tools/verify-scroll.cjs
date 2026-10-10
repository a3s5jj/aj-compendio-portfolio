const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');

(async function () {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 10000 });
  const errors = [];
  const results = [];
  async function ready(page) {
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => {
      const intro = document.querySelector('#preloader');
      return !document.body.classList.contains('is-locked') && (!intro || getComputedStyle(intro).visibility === 'hidden');
    });
  }
  async function samples(page, deltaY, duration = 1400) {
    await page.mouse.move(1000, 650);
    const reading = page.evaluate(ms => new Promise(resolve => {
      const positions = [];
      const start = performance.now();
      function sample() {
        positions.push({ ms: performance.now() - start, y: scrollY, x: scrollX });
        if (performance.now() - start < ms) requestAnimationFrame(sample);
        else resolve(positions);
      }
      requestAnimationFrame(sample);
    }), duration);
    await page.mouse.wheel({ deltaY });
    return reading;
  }
  async function anchor(page, id) {
    await page.click('.nav__link[href="#' + id + '"]');
    await page.waitForFunction(target => {
      const y = document.querySelector('#' + target).getBoundingClientRect().top;
      const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
      return Math.abs(y - padding) < 2 || (target === 'hero' && scrollY < 2);
    }, {}, id);
    assert.equal(await page.evaluate(() => location.hash), '#' + id);
  }
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await ready(page);
    assert(await page.$eval('html', html => html.classList.contains('lenis')));
    const glide = await samples(page, 480);
    assert(glide.some(p => p.y > 0 && p.y < 400), 'Wheel input must ease through intermediate positions');
    assert(glide.filter(p => p.ms < 100).every(p => p.y < 400), 'Wheel input must not jump to its target');
    assert(Math.abs(glide.at(-1).y - 504) < 2, 'Wheel multiplier must match the reference');
    assert(glide.every(p => p.x === 0), 'Scrolling must stay vertical');
    assert(await page.$eval('#header', header => header.classList.contains('is-stuck')));
    assert(await page.$eval('#scrollbarFill', bar => parseFloat(bar.style.width) > 0));
    results.push('vertical wheel easing and scroll indicators');
    console.log(results.at(-1));

    for (const id of ['work', 'contact', 'hero']) await anchor(page, id);
    await page.keyboard.press('PageDown');
    await page.waitForFunction(() => scrollY > 100);
    results.push('section links, fixed-header offsets and keyboard scrolling');
    console.log(results.at(-1));

    await anchor(page, 'work');
    const play = await page.$('.project__watch');
    await play.evaluate(button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.project')).transform === 'none');
    await page.mouse.move(1000, 650);
    await page.mouse.wheel({ deltaY: 300 });
    await play.evaluate(button => button.click());
    const lockedY = await page.evaluate(() => scrollY);
    const locked = await samples(page, 480, 350);
    assert(locked.every(p => Math.abs(p.y - lockedY) < 2), 'Modal must stop in-flight momentum and background scrolling');
    await page.click('#projectVideoClose');
    await page.waitForFunction(() => !document.querySelector('dialog').open);
    const resumed = await samples(page, 240);
    assert(resumed.at(-1).y > lockedY + 200, 'Scrolling must resume after closing the modal');
    results.push('modal stops momentum and resumes scrolling after close');
    console.log(results.at(-1));

    await anchor(page, 'hero');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const reduced = await samples(page, 480, 350);
    assert(!await page.$eval('html', html => html.classList.contains('lenis-smooth')), 'Reduced motion must use native scrolling');
    assert(reduced.some(p => p.ms < 150 && p.y >= 450), 'Reduced motion must not ease wheel input');
    await page.$eval('.project__watch', button => button.click());
    await page.click('#projectVideoRead');
    await page.waitForFunction(() => !document.documentElement.classList.contains('lenis-stopped'));
    assert(await page.evaluate(() => {
      const card = document.querySelector('.project').getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
      return Math.abs((card.top + card.bottom) / 2 - (innerHeight + padding) / 2) < 2;
    }), 'Read details must scroll after the modal releases its lock');
    await anchor(page, 'hero');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !document.body.classList.contains('is-locked'));
    const initiallyReduced = await samples(page, 480, 350);
    assert(initiallyReduced.some(p => p.ms < 150 && p.y >= 450));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    const restored = await samples(page, 480);
    const startY = restored[0].y;
    assert(restored.some(p => p.y > startY && p.y < startY + 400), 'Easing must return when reduced motion is disabled');
    results.push('initial and live reduced-motion preferences');
    console.log(results.at(-1));

    const mobile = await browser.newPage();
    await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await ready(mobile);
    const session = await mobile.createCDPSession();
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 650 }] });
    for (const y of [550, 450, 350, 250]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.waitForFunction(() => scrollY > 100);
    assert(!await mobile.$eval('html', html => html.classList.contains('lenis-smooth')), 'Touch scrolling must remain native');
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth && scrollX === 0));
    results.push('native touch scrolling in mobile emulation');
    console.log(results.at(-1));

    const fallback = await browser.newPage();
    await fallback.setRequestInterception(true);
    fallback.on('request', request => request.url().includes('/lenis-1.3.26.min.js') ? request.abort() : request.continue());
    await fallback.setViewport({ width: 1440, height: 1000 });
    await ready(fallback);
    assert(!await fallback.$eval('html', html => html.classList.contains('lenis')));
    await anchor(fallback, 'work');
    await fallback.$eval('.project__watch', button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await fallback.waitForFunction(() => getComputedStyle(document.querySelector('.project')).transform === 'none');
    await fallback.click('.project__watch');
    await fallback.click('#projectVideoClose');
    assert(!await fallback.$eval('dialog', dialog => dialog.open));
    results.push('missing-library fallback preserves links and video modal');
    console.log(results.at(-1));

    const localFile = await browser.newPage();
    localFile.on('pageerror', error => errors.push(error.message));
    await localFile.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href, { waitUntil: 'load' });
    await localFile.waitForFunction(() => !document.body.classList.contains('is-locked'));
    assert(await localFile.$eval('html', html => html.classList.contains('lenis')));
    results.push('direct filesystem opening');
    console.log(results.at(-1));

    await page.bringToFront();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await anchor(page, 'hero');
    await page.screenshot({ path: path.join(os.tmpdir(), 'portfolio-smooth-scroll.png') });
    assert.deepEqual(errors, []);
    const report = { ok: true, results, wheelSamples: glide, errors };
    fs.writeFileSync(path.join(os.tmpdir(), 'portfolio-scroll-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: true, results, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
