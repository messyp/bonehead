import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cardOverPile} from './dist/gestures.js';

const box=(left,top,width=100,height=140)=>({left,top,width,height,right:left+width,bottom:top+height});
const pile=box(150,200);
assert.ok(cardOverPile({x:200,y:240},null,pile));
assert.ok(cardOverPile({x:210,y:390},box(165,285),pile),'card overlap works when the finger is below the pile');
assert.ok(!cardOverPile({x:30,y:450},box(10,400),pile));
assert.ok(!cardOverPile({x:30,y:450},box(249,339),pile),'one-pixel overlap does not count');

const source=fs.readFileSync('dist/app.js','utf8');
const gestures=source.slice(source.indexOf('// Pointer gestures supplement'),source.indexOf('// Track the actual responsive'));
function setup(legal=true){
  const handlers=new Map(),state={clock:0,plays:0,bad:0,captured:false};
  const target=name=>({addEventListener(type,fn){const key=name+':'+type;handlers.set(key,[...(handlers.get(key)||[]),fn])}});
  const classes={add(){},remove(){},toggle(){}};
  const ghost={style:{},classList:classes,removeAttribute(){},setAttribute(){},remove(){this.removed=true},getBoundingClientRect(){return state.ghostRect||box(150,450)}};
  const el={dataset:{card:'a'},style:{},classList:classes,closest(){return this},cloneNode(){return ghost},getBoundingClientRect(){return box(150,450)},setPointerCapture(){state.captured=true},hasPointerCapture(){return state.captured},releasePointerCapture(){state.captured=false}};
  const hand={...target('hand'),querySelector(){return el}};
  const pileEl={classList:classes,getBoundingClientRect(){return pile}};
  const document={...target('document'),body:{appendChild(){}},hidden:false};
  const ctx={document,window:target('window'),performance:{now:()=>state.clock},Math,
    $:id=>id==='hand'?hand:pileEl,rect:el=>el.getBoundingClientRect(),cardOverPile,
    dragState:null,suppressCardClickUntil:0,started:true,busy:false,moving:false,modalKind:null,
    selected:[],g:{turn:'player',ended:false,player:{hand:[{id:'a'}]}},source:()=> 'hand',valid:()=>legal,
    flickOrigins:new Map(),sound:type=>{if(type==='bad')state.bad++},tone(){},tell(){},motionOn:()=>false,
    playerPlay(){state.plays++}};
  vm.createContext(ctx);vm.runInContext(gestures,ctx);
  function emit(name,type,x=190,y=490){state.clock+=30;for(const fn of handlers.get(name+':'+type)||[])fn({pointerId:1,button:0,isPrimary:true,pointerType:'touch',target:el,clientX:x,clientY:y,preventDefault(){}})}
  return {ctx,state,el,ghost,emit,document};
}
{
  const t=setup();t.emit('hand','pointerdown');assert.ok(t.state.captured);
  t.emit('hand','pointerup');assert.equal(t.state.plays,0);assert.equal(t.ctx.suppressCardClickUntil,0,'tap remains available to click-select');assert.ok(!t.state.captured);
}
for(const outcome of ['valid','invalid','cancel','blur','hidden']){
  const t=setup(outcome!=='invalid');t.emit('hand','pointerdown');
  t.state.ghostRect=box(165,285);t.emit('document','pointermove',210,390);
  assert.equal(t.el.style.visibility,'hidden','document tracks movement outside the hand');
  t.state.clock+=200; // A slow drop, not a velocity-based flick.
  if(outcome==='cancel')t.emit('document','pointercancel',210,390);
  else if(outcome==='blur')t.emit('window','blur');
  else if(outcome==='hidden'){t.document.hidden=true;t.emit('document','visibilitychange')}
  else t.emit('document','pointerup',210,390);
  assert.equal(t.state.plays,outcome==='valid'?1:0,outcome);
  assert.equal(t.state.bad,outcome==='invalid'?1:0,outcome);
  assert.ok(t.ghost.removed);assert.equal(t.el.style.visibility,'');assert.ok(!t.state.captured);
}
console.log('Gesture checks passed: tap-select, touch capture, card-overlap drops, invalid plays, cancellation, blur and background cleanup.');
