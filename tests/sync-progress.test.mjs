import test from 'node:test';
import assert from 'node:assert/strict';
import {syncProgressHtml,syncDockHtml,syncDuration,observeSyncDock,dismissSyncProgress} from '../dist/sync-progress.js';
import {setLocale} from '../dist/i18n.js';

test('source progress never invents completion while requests are in flight',()=>{
 setLocale('zh');
 const progress={status:'running',total:43,completed:0,startedAt:'2026-10-29T07:00:00Z',sources:[{company:'<img onerror=alert(1)>',status:'running',requestsCompleted:12}]};
 const html=syncProgressHtml(progress,Date.parse('2026-10-29T07:01:15Z'));
 assert.match(html,/aria-valuenow="0"/);assert.match(html,/已处理 0 \/ 43/);assert.match(html,/1:15/);assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('sync-current'));assert.ok(!html.includes('sync-footer'));assert.ok(!html.includes('已响应'));
 assert.ok(!syncProgressHtml({status:'running'}).includes('aria-valuenow='));
 assert.equal(syncDuration('invalid'),'0:00');
});

test('running progress reports partial coverage; finished states never render a persistent card',()=>{
 const progress={status:'running',total:3,completed:3,succeeded:2,partial:1,failed:1,jobsReceived:19,startedAt:'2026-10-29T07:00:00Z',finishedAt:'2026-10-29T07:02:01Z',sources:[{company:'A',status:'partial'},{company:'B',status:'failed',error:'<script>no</script>'}]};
 const html=syncProgressHtml(progress,Date.parse('2026-10-29T08:00:00Z'));
 assert.match(html,/100%/);assert.match(html,/2:01/);assert.match(html,/1 个覆盖有限/);assert.match(html,/失败 \/ 待接通/);assert.ok(!html.includes('<details'));assert.ok(!html.includes('<script>'));
 for(const status of ['completed','failed','idle']){
  assert.equal(syncProgressHtml({...progress,status}),'');assert.equal(syncDockHtml({...progress,status}),'');
 }
 setLocale('en');
 assert.match(syncProgressHtml({...progress,status:'running',mode:'search'}),/Searching official job sites/);
 assert.match(syncProgressHtml({...progress,status:'running',connectionLost:true}),/Connection interrupted/);
 setLocale('zh');
});

test('compact progress shares the source count and preserves unknown totals and reconnect status',()=>{
 const progress={status:'running',total:43,completed:3};
 for(const render of [syncProgressHtml,syncDockHtml])assert.match(render(progress),/aria-valuenow="6"/);
 assert.match(syncDockHtml(progress),/3 \/ 43/);
 assert.ok(!syncDockHtml({status:'running'}).includes('aria-valuenow='));
 assert.match(syncDockHtml({...progress,total:3,completed:99}),/100%/);
 setLocale('en');
 assert.match(syncDockHtml({...progress,mode:'search'}),/Searching official jobs/);
 assert.match(syncDockHtml({...progress,connectionLost:true}),/Connection interrupted/);
 setLocale('zh');
});

function element(){
 const classes=new Set(),attributes=new Map();
 return {classes,attributes,removed:false,classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),toggle:(value,on)=>on?classes.add(value):classes.delete(value)},setAttribute:(name,value)=>attributes.set(name,value),remove(){this.removed=true;}};
}
test('the dock appears only after the panel scrolls away, and stale observers cannot reopen it',()=>{
 let bottom=120,callback,disconnected=false;
 const panel={getBoundingClientRect:()=>({bottom})},dock=element();
 const cleanup=observeSyncDock(panel,dock,{IntersectionObserver:class{
  constructor(fn){callback=fn;}observe(target){assert.equal(target,panel);}disconnect(){disconnected=true;}
 }});
 assert.equal(dock.classes.has('is-visible'),false);assert.equal(dock.attributes.get('aria-hidden'),'true');
 bottom=-10;callback();assert.ok(dock.classes.has('is-visible'));assert.equal(dock.attributes.get('aria-hidden'),'false');
 bottom=100;callback();assert.equal(dock.classes.has('is-visible'),false);
 cleanup();bottom=-10;callback();assert.ok(disconnected);assert.equal(dock.classes.has('is-visible'),false);
});
test('completion fades both indicators then removes their space; reduced motion removes them immediately',async()=>{
 const panel=element(),dock=element();dock.classes.add('is-visible');let finish;
 const done=dismissSyncProgress(panel,dock,{matchMedia:()=>({matches:false}),setTimeout:fn=>{finish=fn;}});
 assert.ok(panel.classes.has('is-leaving'));assert.equal(panel.removed,false);assert.equal(dock.classes.has('is-visible'),false);
 finish();await done;assert.ok(panel.removed);assert.ok(dock.removed);
 const reduced=element();await dismissSyncProgress(reduced,null,{matchMedia:()=>({matches:true}),setTimeout:()=>assert.fail('Reduced motion should not wait')});
 assert.ok(reduced.removed);
});
