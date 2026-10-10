const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');

(async () => {
  const proof = path.join(os.tmpdir(), 'portfolio-robot-check');
  fs.mkdirSync(proof, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const errors = [], assetErrors = [], results = [];
  const selector = state => `[data-robot-state="${state}"]`;
  const time = (page, state) => page.$eval(selector(state)+' canvas', canvas => canvas.robotStage.mixer.time);
  async function ready(page) {
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.body.classList.contains('is-locked'));
  }
  async function visit(page, state) {
    await page.$eval(selector(state), element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForSelector(selector(state)+'.is-ready', { timeout: 60000 });
    await page.waitForFunction(state => getComputedStyle(document.querySelector(`[data-robot-state="${state}"]`)).opacity === '1', {}, state);
  }
  async function capture(page, state, name) {
    await page.$eval(selector(state)+' canvas', (canvas, state) => canvas.robotStage.renderAt(state === 'Greeting' ? 2.5 : 3), state);
    await page.screenshot({ path: path.join(proof, name+'.png') });
  }
  try {
    const page = await browser.newPage();
    const modelRequests = [];
    page.on('request', request => { if (request.url().endsWith('/workshop-robot.glb')) modelRequests.push(request.url()); });
    page.on('response', response => { if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400) assetErrors.push(response.url()); });
    await page.setViewport({ width: 1440, height: 1000 });
    await ready(page);
    assert.equal(await page.$$eval('[data-robot-state]', elements => elements.length), 3);
    assert.equal(await page.$eval('#hero [data-robot-state]', element => element.dataset.robotState), 'Greeting');
    assert.equal(await page.$eval('#work [data-robot-state]', element => element.dataset.robotState), 'Working');
    assert.equal(await page.$eval('#contact [data-robot-state]', element => element.dataset.robotState), 'Thinking');
    assert.equal(await page.$$eval('img[src*="assets/avatar/"]', elements => elements.length), 0);
    await visit(page, 'Greeting');
    assert.equal(await page.$$eval('#animationToggle', buttons => buttons.length), 1);
    assert.equal(await page.$$eval('.robot-avatar button', buttons => buttons.length), 0, 'avatars have no embedded controls');
    assert(await page.$eval('#themeToggle', button => button.nextElementSibling.id === 'animationToggle'), 'pause sits beside the theme control');
    assert.equal(await page.$$eval('.robot-avatar.is-ready', elements => elements.length), 1, 'lower avatars stay deferred');
    await page.click('#animationToggle');
    assert.equal(await page.$eval('#animationToggle', button => button.getAttribute('aria-pressed')), 'true');
    const pausedTime = await time(page, 'Greeting');
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await time(page, 'Greeting'), pausedTime, 'pause stops animation');
    await capture(page, 'Greeting', 'hero-dark');
    await page.click('#animationToggle');
    assert.equal(await page.$eval('#animationToggle', button => button.getAttribute('aria-pressed')), 'false');
    await page.waitForFunction(t => document.querySelector('[data-robot-state="Greeting"] canvas').robotStage.mixer.time > t+.05, {}, pausedTime);
    results.push('three replacements, deferred loading and one header pause/resume control');

    for (const [state, duration] of [['Working', 7], ['Thinking', 9]]) {
      await visit(page, state);
      const greetingTime = await time(page, 'Greeting');
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.equal(await time(page, 'Greeting'), greetingTime, 'offscreen avatar stays paused');
      assert.equal(await page.$$eval('.robot-avatar button', buttons => buttons.length), 0);
      await page.click('#animationToggle');
      const clip = await page.$eval(selector(state)+' canvas', canvas => {
        const stage = canvas.robotStage;
        const pose = t => { stage.renderAt(t); const values=[]; stage.model.traverse(object => { if (object.isBone) values.push(...object.matrixWorld.elements); }); return values; };
        const first = pose(0), last = pose(stage.duration);
        return { state: stage.currentState, duration: stage.duration, seam: Math.max(...first.map((value, index) => Math.abs(value-last[index]))) };
      });
      assert.equal(clip.state, state); assert.equal(clip.duration, duration); assert(clip.seam < 1e-5);
      await capture(page, state, state.toLowerCase()+'-dark');
      await page.click('#animationToggle');
    }
    assert.equal(modelRequests.length, 1, 'one cached model download serves all avatars');
    results.push('approved states and durations, matching seams, offscreen pause and shared model cache');

    await visit(page, 'Working');
    await page.click('#animationToggle');
    await page.click('#themeToggle');
    assert.equal(await page.$eval('html', element => element.dataset.theme), 'light');
    await capture(page, 'Working', 'working-light');
    const transparency = await page.$eval(selector('Working')+' img', async image => {
      await image.decode(); const canvas = document.createElement('canvas'); canvas.width=768; canvas.height=768;
      const context=canvas.getContext('2d'); context.drawImage(image,0,0);
      return context.getImageData(0,0,1,1).data[3];
    });
    assert.equal(transparency, 0, 'pose background is transparent');
    assert.equal(await page.$$eval('.project__watch', buttons => buttons.length), 5);
    assert(await page.$eval('form[data-netlify="true"]', form => !!form.querySelector('[name="company"]')));
    await page.$eval('.project__watch', button => button.scrollIntoView({ block:'center', behavior:'instant' }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.project')).transform === 'none');
    await page.click('.project__watch');
    assert(await page.$eval('#projectVideo', dialog => dialog.open));
    await page.click('#projectVideoClose');
    assert(!await page.$eval('#projectVideo', dialog => dialog.open));
    results.push('light theme, transparent fallback, retained contact form and video modal');

    await page.setViewport({ width:390, height:844, isMobile:true, hasTouch:true });
    for (const state of ['Greeting','Working','Thinking']) {
      await visit(page,state);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no mobile overflow');
      assert(await page.$eval(selector(state), element => element.clientWidth <= innerWidth));
      assert(await page.$eval('#animationToggle', button => {
        const bounds = button.getBoundingClientRect();
        const theme = document.querySelector('#themeToggle').getBoundingClientRect();
        const menu = document.querySelector('#burger').getBoundingClientRect();
        return bounds.left >= theme.right && bounds.right <= menu.left && bounds.width >= 40 && bounds.height >= 40;
      }), 'mobile header controls fit without overlap');
      await capture(page,state,'mobile-'+state.toLowerCase());
    }
    results.push('all three mobile layouts');

    const reduced = await browser.newPage();
    let reducedModelRequests=0;
    reduced.on('request', request => { if (request.url().endsWith('/workshop-robot.glb')) reducedModelRequests++; });
    await reduced.emulateMediaFeatures([{ name:'prefers-reduced-motion',value:'reduce' }]);
    await ready(reduced);
    await reduced.waitForNetworkIdle();
    assert.equal(reducedModelRequests,0, 'reduced motion uses static robot poses without downloading the model');
    assert(await reduced.$eval('#portrait', image => image.complete && image.naturalWidth===768));
    assert.equal(await reduced.$eval('#animationToggle', button => button.getAttribute('aria-pressed')), 'true');
    await reduced.click('#animationToggle');
    await visit(reduced,'Greeting');
    assert.equal(await reduced.$eval('#animationToggle', button => button.getAttribute('aria-pressed')), 'false', 'explicit resume can start from reduced motion');
    await reduced.emulateMediaFeatures([{ name:'prefers-reduced-motion',value:'no-preference' }]);
    await visit(reduced,'Greeting');
    await reduced.emulateMediaFeatures([{ name:'prefers-reduced-motion',value:'reduce' }]);
    await new Promise(resolve => setTimeout(resolve,100));
    const reducedTime=await time(reduced,'Greeting');
    await new Promise(resolve => setTimeout(resolve,250));
    assert.equal(await time(reduced,'Greeting'),reducedTime);
    results.push('initial and live reduced-motion preference');

    const fallback=await browser.newPage();
    await fallback.setRequestInterception(true);
    fallback.on('request', request => request.url().endsWith('/workshop-robot.glb') ? request.abort() : request.continue());
    await ready(fallback);
    await fallback.waitForNetworkIdle();
    assert(!await fallback.$eval('.robot-avatar', element => element.classList.contains('is-ready')));
    assert(await fallback.$eval('#portrait', image => image.complete && image.naturalWidth===768 && getComputedStyle(image).opacity==='1'));
    const local=await browser.newPage();
    local.on('pageerror', error => errors.push(error.message));
    await local.goto(pathToFileURL(path.resolve(__dirname,'..','index.html')).href,{ waitUntil:'load' });
    await local.waitForFunction(() => !document.body.classList.contains('is-locked'));
    assert(await local.$eval('#portrait', image => image.complete && image.naturalWidth===768));
    assert.equal(await local.$$eval('.robot-avatar.is-ready', elements => elements.length),0);
    assert.equal(await local.$eval('#animationToggle', button => getComputedStyle(button).display), 'none', 'nonfunctional file-mode control stays hidden');
    results.push('model-load failure and direct-file static fallback');
    assert.deepEqual(assetErrors,[]); assert.deepEqual(errors,[]);
    const report={ ok:true,results,modelDownloads:modelRequests.length,errors,assetErrors,proof };
    fs.writeFileSync(path.join(proof,'verification.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
