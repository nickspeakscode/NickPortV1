const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 for(const [engine,viewport] of [[chromium,{width:1440,height:900}],[webkit,{width:390,height:844}]]){
  if(process.env.TEST_ENGINE&&process.env.TEST_ENGINE!==engine.name())continue;
  const browser=await engine.launch();
  try{for(const colorScheme of ['dark','light']){
   if(process.env.TEST_COLOR_SCHEME&&process.env.TEST_COLOR_SCHEME!==colorScheme)continue;
   const page=await browser.newPage({viewport,colorScheme,hasTouch:viewport.width===390,isMobile:viewport.width===390,deviceScaleFactor:3});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.particleFrames=0;
    const Observer=window.IntersectionObserver;
    window.IntersectionObserver=class extends Observer{constructor(callback,options){super((entries,observer)=>{for(const entry of entries)if(entry.target.classList.contains('timeline-artwork'))window.particleVisible=entry.isIntersecting;callback(entries,observer);},options);}};
    const clear=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.classList.contains('timeline-particles'))particleFrames++;return clear.apply(this,args);};
   });
   await page.goto('http://127.0.0.1:5173/timeline/',{waitUntil:'networkidle'});
   await page.waitForTimeout(600);
   assert.equal(await page.locator('html').getAttribute('data-timeline-theme'),colorScheme);
   const canvas=page.locator('.timeline-particles');
   const dpr=await canvas.evaluate(c=>c.width/c.getBoundingClientRect().width);
   assert.ok(dpr<=2.01,'canvas caps devicePixelRatio at 2');
   await page.screenshot({path:`output/playwright/timeline-kit-${engine.name()}-${colorScheme}-start.png`});
   const first=await canvas.evaluate(c=>c.toDataURL());await page.waitForTimeout(350);
   assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),first,'idle shape turns');
   await page.keyboard.press('ArrowDown');await page.waitForTimeout(1300);
   assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-chapter'),'1');
   await page.keyboard.press('End');await page.waitForTimeout(1800);
   assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-chapter'),'8');
   await page.screenshot({path:`output/playwright/timeline-kit-${engine.name()}-${colorScheme}-end.png`});
   await page.locator('.timeline-scene').evaluate(el=>{el.style.transform='translateX(200vw)';});await page.waitForFunction(()=>particleVisible===false);
   const paused=await page.evaluate(()=>particleFrames);await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>particleFrames),paused,'drawing pauses offscreen');
   await page.locator('.timeline-scene').evaluate(el=>{el.style.transform='';});await page.waitForTimeout(200);
   assert.ok(await page.evaluate(n=>particleFrames>n,paused),'drawing resumes onscreen');
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   const hidden=await page.evaluate(()=>particleFrames);await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>particleFrames),hidden,'visibility handler pauses drawing for a hidden tab');
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
   await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Home');await page.waitForTimeout(300);
   const still=await canvas.evaluate(c=>c.toDataURL());await page.waitForTimeout(300);
   assert.equal(await canvas.evaluate(c=>c.toDataURL()),still,'reduced motion is still');
   await page.emulateMedia({colorScheme:colorScheme==='dark'?'light':'dark'});await page.waitForTimeout(300);
   assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),still,'canvas follows a live theme change');
   assert.deepEqual(errors,[]);
   console.log(`PASS ${engine.name()} ${viewport.width}px ${colorScheme}: DPR cap, idle, chapters, horizon, offscreen/hidden pause, reduced motion, live theme`);
   await page.close();
  }}finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
