const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:5173';
const block=text=>[{_type:'block',style:'normal',markDefs:[],children:[{_type:'span',text,marks:[]}]}];
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{
 for(const section of ['writing','notes']){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>{if(e.message!=='Transition was skipped')errors.push(e.message)});
  await page.route('**/api/record-view',r=>r.fulfill({status:204}));
  let fail=false,title='Original CMS title',body='Original body';
  await page.route('**/data/query/production?**',async r=>{
   await new Promise(resolve=>setTimeout(resolve,180));
   if(fail)return r.fulfill({status:503,body:'{}'});
   const doc={_id:'cache-fixture',slug:'cache-fixture',title,category:'Learning',publishedAt:'2026-01-01',body:block(body)};
   return r.fulfill({json:{result:[doc]}});
  });
  await page.goto(origin+'/'+section+'/');
  await page.getByRole('link',{name:'Original CMS title',exact:false}).waitFor();
  title='Updated title, same slug';body='Updated body';
  await page.reload();
  await page.getByRole('link',{name:title,exact:false}).waitFor();
  if(section==='writing'){
   await page.goto(origin+'/writing/cache-fixture');
   await page.getByRole('heading',{name:title}).waitFor();
   await page.getByText('Updated body',{exact:true}).waitFor();
   body='Fresh revision with unchanged slug';
   await page.reload();await page.getByText(body,{exact:true}).waitFor();
  }
  fail=true;
  await page.goto(origin+'/'+section+'/');
  await page.getByRole('link',{name:title,exact:false}).waitFor();
  await page.waitForTimeout(800);
  assert.equal(await page.getByRole('link',{name:title,exact:false}).count(),1,'a failed refresh keeps cached content');
  if(section==='notes'){
   await page.evaluate(()=>sessionStorage.clear());await page.reload();
   await page.getByText('Notes could not be loaded right now. Please try again shortly.',{exact:true}).waitFor();
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS ${engine.name()} ${section}: changed title/body with stable slug, offline cache retained, no application errors`);
  await page.close();
 }
}finally{await browser.close()}}})().catch(e=>{console.error(e);process.exit(1)});
