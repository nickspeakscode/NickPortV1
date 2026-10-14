const {chromium,webkit,devices}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{for(const engine of [chromium,webkit])for(const mobile of [false,true]){
 const name=engine.name()+'-'+(mobile?'mobile':'desktop');
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==name)continue;
 const browser=await engine.launch({headless:true});
 const page=await browser.newPage(mobile?{...devices['iPhone 13']}:{viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.addInitScript(()=>{
   window.audioProof={starts:[],stops:[],decoded:[],shuffles:[],peak:0};
   const originalAnimate=Element.prototype.animate;
   Element.prototype.animate=function(...args){const a=originalAnimate.apply(this,args);if(this.matches('.portrait-card--photo'))audioProof.shuffles.push({time:document.timeline.currentTime,variation:this.closest('.portrait-shell').dataset.shuffle});return a;};
   const Base=window.AudioContext||window.webkitAudioContext;
   if(!Base){audioProof.unsupported='This browser build does not expose Web Audio';return;}
   window.AudioContext=class extends Base{
     constructor(...args){
       super(...args);window.testAudioContext=this;
       this.meter=this.createAnalyser();this.meter.fftSize=2048;
       const samples=new Float32Array(2048);
       setInterval(()=>{this.meter.getFloatTimeDomainData(samples);for(const sample of samples)audioProof.peak=Math.max(audioProof.peak,Math.abs(sample));},20);
     }
     async decodeAudioData(...args){const b=await super.decodeAudioData(...args);audioProof.decoded.push(b.duration);return b;}
     createBufferSource(){const source=super.createBufferSource();const start=source.start.bind(source),stop=source.stop.bind(source);
       source.start=(when,offset)=>{source.connect(this.meter);audioProof.starts.push({state:this.state,when,contextTime:this.currentTime,timeline:document.timeline.currentTime,offset,duration:source.buffer.duration,variation:document.querySelector('.portrait-shell').dataset.shuffle});return start(when,offset);};
       source.stop=(...args)=>{audioProof.stops.push(document.timeline.currentTime);return stop(...args);};return source;
     }
   };
 });
 await page.goto('http://127.0.0.1:5173/');await page.bringToFront();
 const unsupported=await page.evaluate(()=>audioProof.unsupported);
 if(unsupported){
   await fs.mkdir('test-results/audio',{recursive:true});
   await fs.writeFile(`test-results/audio/${name}.json`,JSON.stringify({status:'not-tested',reason:unsupported},null,2));
   console.log(`NOT TESTED ${name}: ${unsupported}; physical Safari required`);continue;
 }
 await page.waitForTimeout(3500);await page.locator('.portrait-shell[data-state="idle"]').waitFor();
 await page.waitForFunction(()=>audioProof.decoded.length===3);
 assert.equal(await page.evaluate(()=>audioProof.starts.length),0,'nothing plays on load');
 if(!mobile){
   await page.mouse.move(5,5);
   await page.locator('.portrait-shell').hover();
   assert.equal(await page.locator('.portrait-shell').getAttribute('data-state'),'shuffling','hover plays the deck before any click');
   assert.equal(await page.evaluate(()=>audioProof.starts.length),0,'hover cannot start sound');
 }
 const seen=new Set();
 for(let i=0;i<5&&seen.size<3;i++){
   if(mobile)await page.locator('.portrait-shell').tap();else await page.locator('.portrait-shell').click();
   await page.locator('.portrait-shell[data-state="shuffling"]').waitFor();
   const variation=await page.locator('.portrait-shell').getAttribute('data-shuffle');seen.add(variation);
   await page.waitForFunction(count=>audioProof.starts.length===count,i+1);
   await page.locator('.portrait-shell[data-state="idle"]').waitFor();
   assert.ok(await page.evaluate(()=>audioProof.peak>.001),'first click/tap must render actual non-silent audio');
 }
 assert.equal(seen.size,3);
 if(!mobile){
   const count=await page.evaluate(()=>audioProof.starts.length);
   await page.mouse.move(5,5);
   await page.locator('.portrait-shell').hover();
   await page.waitForFunction(count=>audioProof.starts.length===count,count+1);
   await page.locator('.portrait-shell[data-state="idle"]').waitFor();
   // After an audio interruption hover still plays the deck, silently; a
   // click during that trick adds its sound rather than being swallowed.
   await page.evaluate(async()=>{await testAudioContext.suspend();audioProof.peak=0;});
   await page.mouse.move(5,5);await page.locator('.portrait-shell').hover();
   assert.equal(await page.locator('.portrait-shell').getAttribute('data-state'),'shuffling');
   await page.locator('.portrait-shell').click();
   await page.waitForFunction(count=>audioProof.starts.length===count,count+2);
   await page.locator('.portrait-shell[data-state="idle"]').waitFor();
   assert.ok(await page.evaluate(()=>audioProof.peak>.001),'click after interruption must render audio');
 }
 const result=await page.evaluate(()=>audioProof);
 const cue={fan:.50,riffle:1.24,hindu:.936};
 for(const audio of result.starts){
   assert.equal(audio.state,'running');
   const shuffle=result.shuffles.filter(s=>s.time<=audio.timeline+1).at(-1);
   const scheduled=(audio.timeline-shuffle.time)/1000+(audio.when-audio.contextTime)-audio.offset;
   assert.ok(Math.abs(scheduled-cue[audio.variation])<.08,`${name} ${audio.variation}: drift ${scheduled-cue[audio.variation]}`);
   const length={fan:[.70,.74],riffle:[.93,.95],hindu:[.85,.89]}[audio.variation];
   assert.ok(audio.duration>length[0]&&audio.duration<length[1],'wrong decoded clip');
 }
 // Cancel after scheduling and verify no queued audio survives reduced motion.
 await page.locator('.portrait-shell').press('Enter');
 await page.waitForFunction(count=>audioProof.starts.length===count,result.starts.length+1);
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.portrait-shell[data-state="idle"]').waitFor();
 const stops=await page.evaluate(()=>audioProof.stops.length);assert.ok(stops>0);
 assert.deepEqual(errors,[]);
 await fs.mkdir('test-results/audio',{recursive:true});await fs.writeFile(`test-results/audio/${name}.json`,JSON.stringify({...result,stops,errors},null,2));
 console.log(`PASS ${name}: silent hover until a click, trusted activation, correct three recordings, scheduled alignment, cancellation`);
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1});
