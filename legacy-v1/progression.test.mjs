import assert from 'node:assert/strict';
import {deal,play} from './dist/engine.js';
import {claimGoals,earnedTrophies,exchangeHand} from './dist/progression.js';
let g=deal();g.playerBurns=2;assert.equal(claimGoals(g).reduce((a,x)=>a+x.points,0),500);assert.equal(claimGoals(JSON.parse(JSON.stringify(g))).length,0);g.ended=true;g.winner='player';assert.equal(claimGoals(g)[0].points,750);assert.equal(claimGoals(g).length,0);
g=deal();g.playerBurns=2;g.goalBonus=500;assert.equal(claimGoals(g).length,0);
const c=(r,s)=>({r,s,id:`${r}-${s}`});g=deal();assert.deepEqual(earnedTrophies(g,{cards:[c(6,0),c(6,1),c(6,2)]}),['triple','beast']);assert.deepEqual(earnedTrophies(g,{cards:[c(6,0),c(6,1),c(6,2)],pickup:true}),[]);
for(const kind of ['swap','reshuffle']){g=deal();g.items={[kind]:1};const ids=[...g.deck,...g.player.hand].map(x=>x.id).sort(),handSize=g.player.hand.length,deckSize=g.deck.length;assert.ok(exchangeHand(g,kind,g.player.hand[0].id,()=>.4));assert.equal(g.items[kind],0);assert.equal(g.turn,'player');assert.equal(g.player.hand.length,handSize);assert.equal(g.deck.length,deckSize);assert.deepEqual([...g.deck,...g.player.hand].map(x=>x.id).sort(),ids);assert.equal(exchangeHand(g,kind,g.player.hand[0].id),null)}
g=deal();g.items={reshuffle:1};g.deck=[];const before=structuredClone(g);assert.equal(exchangeHand(g,'reshuffle'),null);assert.deepEqual(g,before);
g=deal();g.player.hand=[c(10,0)];g.pile=[c(5,0),c(7,0)];play(g,'player',['10-0']);assert.equal(g.cardsBurned,3);
console.log('Progression checks passed: immediate one-time goals, saved payout migration, exact 666 trophy, exchanges conserve cards/turn, counters.');
