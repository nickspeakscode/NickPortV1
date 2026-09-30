const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
(async () => {
 for (const engine of [chromium, webkit]) {
  if(process.env.TEST_ENGINE && process.env.TEST_ENGINE!==engine.name()) continue;
  const browser=await engine.launch();
  try {
   for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    if(process.env.TEST_WIDTH&&Number(process.env.TEST_WIDTH)!==viewport.width)continue;
    const page=await browser.newPage({viewport,isMobile:viewport.width<900,hasTouch:viewport.width<900,deviceScaleFactor:viewport.width<900?2:1,colorScheme:process.env.TEST_COLOR_SCHEME||'dark'});
    const errors=[];
    page.on('pageerror',e=>{
     if(e.message==='Transition was skipped') console.log('NOTE browser cancelled a superseded navigation transition');
     else errors.push(e.message);
    });
    await page.goto(origin+'/timeline/');
    const waitChapter=async index=>{
     await page.waitForFunction(i=>document.querySelector(`[data-chapter="${i}"]`)?.getAttribute('aria-current')==='step',index).catch(async error=>{
      console.error('Expected chapter',index,viewport,await page.evaluate(()=>({current:document.querySelector('[aria-current]')?.getAttribute('data-chapter'),progress:document.querySelector('.timeline-progress span')?.style.transform,hidden:document.hidden,url:location.href})));
      throw error;
     });
     await page.waitForTimeout(650);
     assert.equal(await page.locator('.story-chapter:not([aria-hidden="true"])').count(),1);
     const bounds=await page.evaluate(()=>({scrollY,overflow:document.documentElement.scrollWidth>innerWidth,scrollable:document.documentElement.scrollHeight>innerHeight+1}));
     assert.deepEqual(bounds,{scrollY:0,overflow:false,scrollable:false},'only the scene moves; the document never scrolls');
     const text=await page.locator('.story-chapter.is-current').boundingBox();
     const controls=await page.locator('.timeline-controls').boundingBox();
     assert.ok(text.y>=55&&text.y+text.height<=controls.y,`text fits ${viewport.width}x${viewport.height}: ${JSON.stringify(text)}`);
     const rail=await page.locator('.timeline-chapters').boundingBox();
     assert.ok(rail.y>=60&&rail.y+rail.height<viewport.height);
     const art=await page.locator('.timeline-artwork').boundingBox();
     const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
     assert.equal(overlaps(art,rail),false,'particle canvas stays clear of the chapter rail');
     assert.equal(overlaps(art,text),false,'particle canvas stays clear of the story');
     assert.equal(overlaps(art,controls),false,'particle canvas stays clear of the controls');
    };
    await waitChapter(0);
    assert.equal(await page.locator('[data-chapter]').count(),9);
    assert.equal(await page.locator('.chapter-card').count(),9);
    assert.equal(await page.locator('canvas.timeline-mountains').count(),1,'the horizon, mountain and sun are drawn as dots');
    assert.equal(await page.locator('.timeline-home').count(),0);
    assert.equal(await page.locator('.timeline-header a').count(),1);
    assert.equal(await page.getByRole('button',{name:'Previous chapter',exact:true}).isDisabled(),true);
    const canvas=page.locator('.timeline-particles');
    const centroid=()=>canvas.evaluate(c=>{
     const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     let count=0,x=0,y=0,r2=0;
     for(let i=3;i<pixels.length;i+=4)if(pixels[i]>50){const px=(i/4)%c.width,py=Math.floor((i/4)/c.width);count++;x+=px;y+=py;r2+=px*px+py*py;}
     const ratio=c.height/c.getBoundingClientRect().height;
     return {count,x:x/count/ratio,y:y/count/ratio,spread:Math.sqrt(r2/count-(x/count)**2-(y/count)**2)/ratio};
    });
    assert.ok((await centroid()).count>500,'the illustration contains visible dots');
    assert.equal(await page.locator('.timeline-scene img').count(),0,'including Sumlino, all visible artwork is dots');
    const firstShape=await canvas.evaluate(c=>c.toDataURL());
    const resting=await centroid();
    if(viewport.width>900){
     const box=await canvas.boundingBox();
     await page.evaluate(()=>{window.pointerProof=[];for(const type of ['pointermove','pointerleave'])document.querySelector('.timeline-viewport').addEventListener(type,e=>pointerProof.push({type,x:e.clientX,y:e.clientY,pointer:e.pointerType}));});
     await page.mouse.move(5,5);
     await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2,{steps:8});
     await page.waitForTimeout(550);
     const dispersed=await canvas.evaluate(c=>c.toDataURL())!==firstShape;
     if(!dispersed)console.error('Pointer check',box,await page.evaluate(()=>({events:pointerProof,hidden:document.hidden,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches})));
     assert.ok(dispersed,'cursor separates the dots');
     await page.mouse.move(5,5);await page.waitForTimeout(1600);
     assert.ok(Math.abs((await centroid()).spread-resting.spread)<resting.spread*.06,'hover returns to the original formation while its gentle idle motion continues');
    }
    const art=page.locator('.timeline-artwork');
    if(viewport.width<900) await art.tap(); else await art.click();
    await page.waitForTimeout(300);
    assert.ok((await centroid()).spread>resting.spread*1.1,'click or tap disperses the entire illustration');
    await page.mouse.move(5,5);
    await page.waitForTimeout(2100);
    assert.ok(Math.abs((await centroid()).spread-resting.spread)<resting.spread*.06,'click burst returns cleanly to the same illustration');
    await art.focus(); await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.ok((await centroid()).spread>resting.spread*1.1,'keyboard activation also disperses');
    await page.waitForTimeout(2100);
    await page.keyboard.press('ArrowDown'); await waitChapter(1);
    assert.match(await page.locator('.story-chapter.is-current').innerText(), /high school with a 4.0 GPA/);
    assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),firstShape,'dots form a different illustration');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await waitChapter(3);
    assert.match(await page.locator('.story-chapter.is-current').innerText(), /The Tribe/);
    assert.ok((await page.locator('.story-chapter.is-current').innerText()).includes('$150,000'));
    await page.keyboard.press('ArrowUp'); await waitChapter(2);
    await page.keyboard.press('Home'); await waitChapter(0);
    await page.mouse.move(5,5);
    const wheel=async deltaY=>{
     if(engine.name()==='webkit'&&viewport.width<900) {
      // Playwright's mobile WebKit lacks wheel injection; exercise the handler
      // synthetically here and use real taps for this browser's touch controls.
      await page.locator('.timeline-viewport').dispatchEvent('wheel',{deltaY,deltaMode:0,bubbles:true,cancelable:true});
     }else {
      // Chromium's emulated touch viewport scales injected wheel deltas by DPR.
      const factor=engine.name()==='chromium'&&viewport.width<900?2:1;
      await page.mouse.wheel(0,deltaY*factor);
     }
    };
    const originalY=(await centroid()).y;
    await wheel(140);await page.waitForTimeout(100);
    const mid=(await centroid());
    assert.ok(mid.count>500&&Math.abs(mid.y-originalY)<80,'the continuous dot field remains on screen during the morph');
    assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),firstShape,'scroll begins unforming the current illustration');
    await waitChapter(1);
    await page.keyboard.press('Home'); await waitChapter(0);
    for(let event=0;event<8;event++){await wheel(80);await page.waitForTimeout(12);}
    await waitChapter(1);
    assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-chapter'),'1','one wheel gesture plus inertia advances exactly one chapter');
    await page.keyboard.press('Home'); await waitChapter(0);
    await wheel(620); await waitChapter(1);
    await wheel(-620); await waitChapter(0);
    await wheel(180); await waitChapter(1);
    await page.waitForTimeout(800);
    const settled=await canvas.evaluate(c=>c.toDataURL());
    const settledProgress=await page.locator('.timeline-progress span').getAttribute('style');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.timeline-progress span').getAttribute('style'),settledProgress,'each gesture finishes its chapter without drifting to another');
    assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),settled,'the complete illustration has subtle idle movement');
    await page.keyboard.press('Home'); await waitChapter(0);
    if(engine.name()==='chromium'&&viewport.width<900) {
     const cdp=await page.context().newCDPSession(page);
     const x=viewport.width/2,y=viewport.height*.7;
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
     for(let step=1;step<=10;step++) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*20}]});
      await page.waitForTimeout(16);
     }
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await waitChapter(1);
     await cdp.detach();
    }
    for(let index=0;index<9;index++) {
     const button=page.locator(`[data-chapter="${index}"]`);
     if(viewport.width<900) await button.tap(); else await button.click();
     await waitChapter(index).catch(async error=>{
      console.error('Chapter failure',index,engine.name(),viewport,await page.evaluate(()=>({active:document.querySelector('[aria-current]')?.outerHTML,progress:document.querySelector('.timeline-progress span').style.transform,focus:document.activeElement?.outerHTML,hidden:document.hidden})));
      throw error;
     });
     assert.ok((await centroid()).count>500,`chapter ${index} has a visible formation`);
    }
    await page.keyboard.press('End'); await waitChapter(8);
    assert.match(await page.locator('.story-chapter.is-current').innerText(),/still a student/);
    const future=await canvas.evaluate(c=>c.toDataURL());
    await page.waitForTimeout(250);
    assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),future,'the final particles continue toward the horizon');
    assert.equal(await page.getByRole('button',{name:'Next chapter',exact:true}).isDisabled(),true);
    await page.reload(); await waitChapter(8);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.keyboard.press('Home'); await waitChapter(0);
    const still=await canvas.evaluate(c=>c.toDataURL());
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(300);
    assert.equal(await canvas.evaluate(c=>c.toDataURL()),still,'reduced motion also disables cursor dispersal');
    assert.equal(await art.getAttribute('aria-disabled'),'true');
    await art.focus();await page.keyboard.press('Enter');await page.waitForTimeout(300);
    assert.equal(await canvas.evaluate(c=>c.toDataURL()),still,'reduced motion disables the click burst');
    await page.keyboard.press('End'); await waitChapter(8);
    await page.getByRole('link',{name:'Close timeline and return home'}).click();
    await page.waitForURL(origin+'/#home');
    const entry=page.getByRole('link',{name:'Explore my timeline'});
    await entry.waitFor();
    assert.equal(await page.locator('.portrait-stage a').count(),0);
    assert.equal(await page.locator('.portrait-shell a').count(),0,'timeline is a separate control, not nested in the shuffle button');
    assert.equal(await page.locator('.hero-actions a[href^="mailto:"]').count(),1);
    assert.equal(await page.locator('.hero-actions a[href="/timeline/"]').count(),1);
    const link=await entry.boundingBox();
    const card=await page.locator('.portrait-shell').boundingBox();
    assert.ok(link.width>=44&&link.height>=44&&link.x>=0&&link.x+link.width<=viewport.width,'portrait link fits with a full touch target');
    assert.ok(link.x>=card.x+card.width+20||link.y>=card.y+card.height+30,'timeline link is well clear of the portrait');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('.portrait-shell').click();
    await page.locator('.portrait-shell[data-state="shuffling"]').waitFor();
    await entry.click();
    await page.waitForURL(origin+'/timeline/');
    assert.deepEqual(errors,[]);
    console.log(`PASS ${engine.name()} ${viewport.width}x${viewport.height}: continuous morph, click/tap burst, card ranks, nine chapters, keys, touch, reduced motion, restore, portrait link`);
    await page.close();
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
