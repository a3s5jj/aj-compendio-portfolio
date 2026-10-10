const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

(async function () {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    const page = await browser.newPage();
    const errors = [];
    const mediaRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/assets/videos/')) mediaRequests.push(request.url()); });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:4173/#work', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !document.querySelector('#preloader') || getComputedStyle(document.querySelector('#preloader')).visibility === 'hidden');
    assert.equal(mediaRequests.length, 0, 'Videos must not load before a visitor clicks play');
    assert.equal(await page.$$eval('.project__watch', buttons => buttons.length), 5);
    assert.equal(await page.$$eval('button button', buttons => buttons.length), 0);

    for (const [index, duration] of [30, 24, 29, 27.333333, 44.1].entries()) {
      console.log('Checking player ' + (index + 1));
      const buttons = await page.$$('.project__watch');
      const before = await page.evaluate(i => document.querySelectorAll('.project')[i].classList.contains('is-open'), index);
      await buttons[index].evaluate(button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForFunction(i => getComputedStyle(document.querySelectorAll('.project')[i]).transform === 'none', {}, index);
      await buttons[index].click();
      await page.waitForFunction(() => { const v = document.querySelector('video'); return v.readyState >= 2 && !v.paused && v.currentTime > .1; });
      const state = await page.evaluate(i => {
        const v = document.querySelector('video');
        return { duration: v.duration, width: v.videoWidth, height: v.videoHeight, controls: v.controls, inline: v.playsInline, expanded: document.querySelectorAll('.project')[i].classList.contains('is-open'), focused: document.activeElement.id };
      }, index);
      assert(Math.abs(state.duration - duration) < .15);
      assert.equal(state.width, 1920); assert.equal(state.height, 1080);
      assert(state.controls && state.inline); assert.equal(state.expanded, before);
      assert.equal(state.focused, 'projectVideoClose');
      if (index === 0) {
        for (let step = 0; step < 8; step++) {
          await page.keyboard.press('Tab');
          assert(await page.$eval('dialog', dialog => dialog.contains(document.activeElement)), 'Keyboard focus escaped the modal');
        }
      }
      await page.evaluate(time => { const v = document.querySelector('video'); v.pause(); v.currentTime = time; }, duration / 2);
      await page.waitForFunction(time => { const v = document.querySelector('video'); return !v.seeking && Math.abs(v.currentTime - time) < .05; }, {}, duration / 2);
      if ([0, 3, 4].includes(index)) {
        await page.evaluate(() => { document.querySelector('video').textTracks[0].mode = 'showing'; });
        await page.waitForFunction(() => document.querySelector('video').textTracks[0].cues?.length > 0);
      } else {
        assert.equal(await page.$eval('video', v => v.textTracks.length), 0, 'SFX films have no narration track');
      }
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog').open && !document.querySelector('video').hasAttribute('src'));
      assert(await page.evaluate(i => { const v = document.querySelector('video'); return v.paused && !v.hasAttribute('src') && document.activeElement === document.querySelectorAll('.project__watch')[i] && !document.documentElement.classList.contains('has-project-video'); }, index));
      results.push({ index: index + 1, ...state, playback: true, seek: true, closeAndFocus: true });
    }

    const quote = await page.$('.project__watch[data-video$="quote.mp4"]');
    await quote.click();
    await page.click('#projectVideoRead');
    await page.waitForFunction(() => document.activeElement === document.querySelectorAll('.project__head')[4]);
    assert(await page.$eval('.project:last-child', card => card.classList.contains('is-open')));
    await page.click('.project:last-child .project__head');
    assert.equal(await page.$eval('.project:last-child .project__head', button => button.getAttribute('aria-expanded')), 'false');

    for (const width of [320, 390, 736, 768, 1280]) {
      console.log('Checking viewport ' + width);
      await page.setViewport({ width, height: width === 736 ? 414 : 844 });
      await new Promise(resolve => setTimeout(resolve, 700));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflows at ${width}px`);
      assert(await page.$$eval('.project__watch', buttons => buttons.every(button => {
        const rect = button.getBoundingClientRect(), row = button.closest('.project__row').getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44 && rect.left >= row.left && rect.right <= row.right && rect.bottom <= row.bottom;
      })), `Play buttons do not fit at ${width}px`);
      await page.$eval('.project__watch', button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.click('.project__watch');
      await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
      assert(await page.$eval('dialog', dialog => { const rect = dialog.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight; }));
      await page.click('#projectVideoClose');
      await page.waitForFunction(() => !document.querySelector('dialog').open && !document.querySelector('video').hasAttribute('src'));
    }

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setViewport({ width: 390, height: 844 });
    await page.$eval('.project__watch', button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.click('.project__watch');
    await page.click('#projectVideoClose');
    await page.waitForFunction(() => !document.querySelector('dialog').open && !document.querySelector('video').hasAttribute('src'));
    await page.evaluate(() => { document.querySelectorAll('.project').forEach(card => { card.classList.remove('is-open'); card.querySelector('.project__head').setAttribute('aria-expanded', 'false'); }); });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.evaluate(() => document.querySelector('#projects').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await new Promise(resolve => setTimeout(resolve, 700));
    await page.screenshot({ path: path.join(os.tmpdir(), 'portfolio-videos-mobile.png') });
    await page.setViewport({ width: 1440, height: 1000 });
    await new Promise(resolve => setTimeout(resolve, 700));
    await page.evaluate(() => document.querySelector('#projects').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: path.join(os.tmpdir(), 'portfolio-videos-desktop.png') });
    await page.$eval('.project__watch', button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.click('.project__watch');
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
    await page.evaluate(() => { const v = document.querySelector('video'); v.pause(); v.currentTime = 20.99; });
    await page.waitForFunction(() => !document.querySelector('video').seeking);
    await page.screenshot({ path: path.join(os.tmpdir(), 'portfolio-videos-player.png') });
    await page.click('#projectVideoClose');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.click('.project__watch');
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
    await page.evaluate(() => { const v = document.querySelector('video'); v.pause(); v.currentTime = 1.9; });
    await page.waitForFunction(() => !document.querySelector('video').seeking);
    await page.screenshot({ path: path.join(os.tmpdir(), 'portfolio-videos-player-light.png') });
    await page.mouse.click(4, 4);
    await page.waitForFunction(() => !document.querySelector('dialog').open && !document.querySelector('video').hasAttribute('src'));
    assert.equal(await page.$eval('#projectVideoError', error => error.hidden), true);
    assert.deepEqual(errors, []);

    const failurePage = await browser.newPage();
    await failurePage.setRequestInterception(true);
    failurePage.on('request', request => request.url().endsWith('/clinic.mp4') ? request.abort() : request.continue());
    await failurePage.goto('http://127.0.0.1:4173/#work', { waitUntil: 'networkidle0' });
    await failurePage.waitForFunction(() => !document.querySelector('#preloader') || getComputedStyle(document.querySelector('#preloader')).visibility === 'hidden');
    await failurePage.$eval('.project__watch', button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await failurePage.waitForFunction(() => getComputedStyle(document.querySelector('.project')).transform === 'none');
    await failurePage.click('.project__watch');
    await failurePage.waitForFunction(() => !document.querySelector('#projectVideoError').hidden);
    assert(await failurePage.$eval('#projectVideoDownload', link => link.href.endsWith('/assets/videos/clinic.mp4') && link.hasAttribute('download')));
    await failurePage.keyboard.press('Escape');
    await failurePage.waitForFunction(() => !document.querySelector('video').hasAttribute('src'));
    await failurePage.close();
    const report = { ok: true, results, widths: [320, 390, 736, 768, 1280], optionalCaptions: true, deferredMedia: true, readDetails: true, reducedMotion: true, backdropClose: true, focusTrap: true, failedMediaFallback: true, errors };
    fs.writeFileSync(path.join(os.tmpdir(), 'portfolio-video-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
