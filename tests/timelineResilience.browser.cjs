const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
 for (const engine of [chromium, webkit]) {
  if (process.env.TEST_ENGINE && process.env.TEST_ENGINE !== engine.name()) continue;
  const browser = await engine.launch();
  try {
   const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'light'});
   const errors = [];
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>{
    window.paintTimes=[]; window.sampleMotion=false;
    const clear=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){
     if(window.sampleMotion && this.canvas.classList.contains('timeline-particles'))window.paintTimes.push(performance.now());
     return clear.apply(this,args);
    };
   });
   // An unavailable sampling image must never blank this or the preceding chapter.
   await page.route('**/sumlino-founder.png',route=>route.abort());
   await page.goto('http://127.0.0.1:5173/timeline/');
   await page.emulateMedia({reducedMotion:'reduce'});
   const visibleDots=()=>page.locator('.timeline-particles').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let dots=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>40)dots++;
    return dots;
   });
   for(const chapter of [6,7,8]){
    await page.locator(`[data-chapter="${chapter}"]`).tap();
    await page.waitForFunction(i=>document.querySelector(`[data-chapter="${i}"]`).hasAttribute('aria-current'),chapter);
    assert.ok(await visibleDots()>500,`chapter ${chapter+1} remains visible when Sumlino source fails`);
   }
   await page.keyboard.press('Home');
   await page.waitForFunction(()=>document.querySelector('.timeline-progress span').style.transform==='scaleX(0)');
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.waitForTimeout(150);
   const pacing=await page.evaluate(()=>new Promise(resolve=>{
    paintTimes=[];sampleMotion=true;let frames=0;const start=performance.now();
    function sample(now){frames++;if(now-start<700)requestAnimationFrame(sample);else{sampleMotion=false;resolve({frames,paints:paintTimes.length});}}
    requestAnimationFrame(sample);
   }));
   assert.ok(pacing.paints>=pacing.frames*.8,'idle and interactions are not quantized to every other browser frame');
   // Hide midway through a morph. It should stay paused and then continue,
   // rather than catch up abruptly in a few frames when Safari resumes.
   await page.keyboard.press('ArrowDown');
   const progress=()=>page.locator('.timeline-progress span').evaluate(el=>Number(el.style.transform.match(/scaleX\(([^)]+)\)/)[1]));
   await page.waitForFunction(()=>{const n=Number(document.querySelector('.timeline-progress span').style.transform.match(/scaleX\(([^)]+)\)/)[1]);return n>.02&&n<.09;});
   const before=await progress();assert.ok(before>0&&before<.125);
   const paused=await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
    return Number(document.querySelector('.timeline-progress span').style.transform.match(/scaleX\(([^)]+)\)/)[1]);
   });
   await page.waitForTimeout(250);
   assert.equal(await progress(),paused);
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
   await page.waitForTimeout(120);
   const resumed=await progress();
   assert.ok(resumed>=paused&&resumed<.11,'resume preserves a visible, gradual transition');
   await page.waitForFunction(()=>document.querySelector('.timeline-progress span').style.transform==='scaleX(0.125)');
   assert.deepEqual(errors,[]);
   console.log(`PASS ${engine.name()} phone: failed image fallback, frame pacing ${pacing.paints}/${pacing.frames}, paused morph resumes smoothly`);
   await page.close();
  } finally { await browser.close(); }
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
