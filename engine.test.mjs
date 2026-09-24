import assert from 'node:assert/strict';
import {deal,rule,legal,valid,play,pickup,options,source} from './dist/engine.js';
// Seed the random strategy so long-game regressions are reproducible.
let seed=42;Math.random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const c=(r,s=0,id=`${r}-${s}`)=>({r,s,id});
assert.deepEqual(rule([c(9),c(8)]),{r:9,low:true});assert.equal(legal(c(11),[c(9),c(8)]),false);assert.equal(legal(c(7),[c(9),c(8)]),true);assert.equal(legal(c(9),[c(14)]),true);assert.equal(legal(c(10),[c(14)]),true);assert.equal(legal(c(2),[c(14)]),true);assert.equal(legal(c(8),[c(14)]),true);
assert.equal(valid([c(2,1),c(3,1),c(4,1)],[c(14)]),true);assert.equal(valid([c(4,1),c(5,0)],[]),false);assert.equal(valid([c(10),c(11)],[]),false);
let g=deal();g.pile=[c(7,0),c(7,1),c(7,2)];g.player.hand=[c(7,3)];let res=play(g,'player',['7-3']);assert.equal(res.burn,true);assert.equal(g.pile.length,0);assert.equal(g.turn,'player');assert.equal(g.player.hand.length,3);
g=deal();g.deck=[];g.player={hand:[],face:[],blind:[c(4)]};g.pile=[c(12)];res=play(g,'player',['4-0']);assert.equal(res.pickup,true);assert.equal(g.player.hand.length,2);assert.equal(source(g.player),'hand');assert.equal(g.turn,'house');assert.equal(g.ended,false);
g=deal();g.deck=[];g.player={hand:[],face:[],blind:[c(14)]};res=play(g,'player',['14-0']);assert.equal(g.winner,'player');
let finished=0,maxMoves=0;for(let i=0;i<500;i++){g=deal();let burned=0;for(let move=0;move<20000&&!g.ended;move++){let who=g.turn;let opts=options(g,who);if(opts.length){let choice=opts[Math.floor(Math.random()*opts.length)];let r=play(g,who,choice.map(c=>c.id));assert.ok(!r.error);if(r.burn)burned+=r.size}else assert.ok(pickup(g,who));const all=[...g.deck,...g.pile,...g.player.hand,...g.player.face,...g.player.blind,...g.house.hand,...g.house.face,...g.house.blind];assert.equal(all.length+burned,52);assert.equal(new Set(all.map(x=>x.id)).size,all.length);maxMoves=Math.max(maxMoves,move)}if(g.ended)finished++}assert.equal(finished,500);console.log(`All rule tests passed. ${finished}/500 simulated games completed; max ${maxMoves} moves. Card conservation verified each move.`);
