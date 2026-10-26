import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import Database from 'better-sqlite3';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function freePort() { const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r)); const port=server.address().port; await new Promise(r=>server.close(r)); return port; }

test('meal library, snapshots, historical entry and agent API', async () => {
  const dir=mkdtempSync(join(tmpdir(),'tft-test-'));
  const legacyTargets={protein:120,carbs:220,fat:60,kcal:1950};
  const legacyDb=new Database(join(dir,'test.sqlite'));
  legacyDb.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  legacyDb.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run('targets',JSON.stringify(legacyTargets));
  legacyDb.close();
  const port=await freePort();
  const token='integration-test-agent-token-12345678901234567890';
  const password='integration-test-password-123';
  const child=spawn(process.execPath,[resolve('dist/server.js')],{cwd:resolve('.'),env:{...process.env,FITNESS_APP_PASSWORD:password,FITNESS_SESSION_SECRET:'integration-test-secret-123456789012345678901234',FITNESS_AGENT_TOKEN:token,FITNESS_DB_PATH:join(dir,'test.sqlite'),PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let logs=''; child.stderr.on('data',chunk=>logs+=String(chunk)); child.stdout.on('data',chunk=>logs+=String(chunk));
  const base=`http://127.0.0.1:${port}`;
  const call=async (path,method='GET',body,auth=token) => {const res=await fetch(base+path,{method,headers:{authorization:`Bearer ${auth}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const value=await res.json();assert.ok(res.ok,`${method} ${path}: ${JSON.stringify(value)}`);return value;};
  try {
    let ready=false;
    for(let i=0;i<80;i++){if(child.exitCode!==null)break;try{const res=await fetch(base+'/api/health');if(res.ok){ready=true;break;}}catch{}await sleep(100);}
    assert.ok(ready,`API did not start: ${logs}`);
    const denied=await fetch(base+'/api/meals');assert.equal(denied.status,401);
    const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie')??'',/HttpOnly/);
    const meals=await call('/api/meals');assert.ok(meals.length>=28);assert.equal(meals.find(m=>m.code==='B6').variants.length,2);
    assert.deepEqual(meals.find(m=>m.code==='B6').categories,['breakfast']);
    assert.match(meals.find(m=>m.code==='B6').ingredients_text,/cottage/i);
    const products=await call('/api/products');assert.ok(products.length>=13);
    const plan=await call('/api/settings/targets/current');
    const previousDate=new Date(`${plan.effectiveDay}T12:00:00Z`);previousDate.setUTCDate(previousDate.getUTCDate()-1);
    const previousDay=previousDate.toISOString().slice(0,10);
    const oldDay=await call(`/api/days/${previousDay}`);
    assert.deepEqual(oldDay.targets,legacyTargets,'existing targets migrate as the baseline');
    const changedTargets={protein:145,carbs:210,fat:70,kcal:2050};
    await call('/api/settings/targets','PUT',changedTargets);
    assert.deepEqual((await call('/api/settings/targets/current')).targets,changedTargets);
    assert.deepEqual((await call(`/api/days/${previousDay}`)).targets,oldDay.targets,'past days keep their targets');
    assert.deepEqual((await call(`/api/days/${plan.effectiveDay}`)).targets,changedTargets);
    const nextDate=new Date(`${plan.effectiveDay}T12:00:00Z`);nextDate.setUTCDate(nextDate.getUTCDate()+1);
    assert.deepEqual((await call(`/api/days/${nextDate.toISOString().slice(0,10)}`)).targets,changedTargets);
    const product=await call('/api/products','POST',{alias:'test yoghurt',name:'Test yoghurt',referenceAmount:100,unit:'g',protein:10,carbs:5,fat:2,kcal:78,salt:0.1});
    const meal=await call('/api/meals','POST',{code:'B99',title:'Test bowl',categories:['breakfast','snack'],ingredientsText:'150 g yoghurt',description:'Test'});
    assert.deepEqual(meal.categories,['breakfast','snack']);
    assert.equal(meal.ingredients_text,'150 g yoghurt');
    const revised=await call(`/api/meals/${meal.id}`,'PATCH',{ingredientsText:'Greek yoghurt'});
    assert.deepEqual(revised.categories,['breakfast','snack'],'partial update retains categories');
    assert.equal(revised.ingredients_text,'Greek yoghurt');
    const variant=await call(`/api/meals/${meal.id}/variants`,'POST',{name:'With yoghurt',macroMode:'computed',ingredients:[{productId:product.id,amount:150}],isDefault:true});
    assert.equal(variant.protein,15);
    const entry=await call('/api/entries','POST',{day:'2026-10-20',kind:'meal',variantId:variant.id,amount:1});
    const before=await call('/api/days/2026-10-20');assert.equal(before.total.protein,15);assert.equal(before.total.kcal,117);assert.equal(before.items[0].snapshot_detail.ingredients[0].productName,'Test yoghurt');
    await call(`/api/products/${product.id}`,'PATCH',{protein:20,kcal:118});
    const updatedMeal=(await call('/api/meals')).find(m=>m.id===meal.id);assert.equal(updatedMeal.variants[0].protein,30);
    const after=await call('/api/days/2026-10-20');assert.equal(after.total.protein,15,'logged meal snapshot must not change');
    await call('/api/days/2026-10-20/sleep','PUT',{minutes:420,source:'manual'});
    await call('/api/measurements','POST',{day:'2026-10-20',weightKg:69.2,waistCm:83.1,source:'manual'});
    const context=await call('/api/agent/context?day=2026-10-20');assert.equal(context.day.sleep.minutes,420);
    await call('/api/agent/checkins/2026-10-20','PUT',{text:'Integration check-in'});
    const checked=await call('/api/days/2026-10-20');assert.equal(checked.checkin.text,'Integration check-in');
    await call(`/api/entries/${entry.id}`,'PATCH',{notes:'Only a note changed'});
    const changed=await call('/api/days/2026-10-20');assert.equal(changed.total.protein,15);assert.equal(changed.checkinStale,true);
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
    rmSync(dir,{recursive:true,force:true});
  }
});

test('existing meal rows migrate to searchable ingredients and multiple categories', async () => {
  const dir=mkdtempSync(join(tmpdir(),'tft-migration-'));
  const path=join(dir,'old.sqlite');
  const legacy=new Database(path);
  legacy.exec('CREATE TABLE meals (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL, description TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
  legacy.prepare('INSERT INTO meals (id,code,title,category,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('old-meal','B1','B1 · Omelette','breakfast','B1 · Omelette. 3 eggs + spinach','2026-01-01','2026-01-01');
  legacy.close();
  const port=await freePort();
  const token='migration-test-agent-token-12345678901234567890';
  const child=spawn(process.execPath,[resolve('dist/server.js')],{cwd:resolve('.'),env:{...process.env,FITNESS_APP_PASSWORD:'migration-test-password-123',FITNESS_SESSION_SECRET:'migration-test-secret-123456789012345678901234',FITNESS_AGENT_TOKEN:token,FITNESS_DB_PATH:path,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let logs='';child.stderr.on('data',chunk=>logs+=String(chunk));child.stdout.on('data',chunk=>logs+=String(chunk));
  try {
    let response;
    for(let i=0;i<80;i++){if(child.exitCode!==null)break;try{response=await fetch(`http://127.0.0.1:${port}/api/meals`,{headers:{authorization:`Bearer ${token}`}});if(response.ok)break;}catch{}await sleep(100);}
    assert.ok(response?.ok,`API did not start: ${logs}`);
    const meal=(await response.json())[0];
    assert.equal(meal.title,'Omelette');
    assert.deepEqual(meal.categories,['breakfast']);
    assert.equal(meal.ingredients_text,'3 eggs + spinach');
  } finally {
    child.kill();
    if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));
    rmSync(dir,{recursive:true,force:true});
  }
});
