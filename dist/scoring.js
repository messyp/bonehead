// Bonuses are optional: clearing your cards always advances the run.
export const MAGIC_POINTS=Object.freeze({2:200,8:240,9:260,10:300});
export function cardPoints(card){return MAGIC_POINTS[card.r]??(card.r===14?150:card.r*10)}
export function comboReward(cards,chain=false){
  if(!cards.length)return {mult:1,reason:'SINGLE CARD'};
  const counts={};for(const c of cards)counts[c.r]=(counts[c.r]||0)+1;
  const largest=Math.max(...Object.values(counts));
  const matchBonus=largest>=4?1.5:largest===3?.5:0;
  const mult=1+(cards.length-1)*.5+matchBonus+(chain?(cards.length-1)*.25:0);
  const reason=[cards.length===1?'SINGLE CARD':`${cards.length} CARDS`,largest>=4?'FOUR OF A KIND':largest===3?'THREE OF A KIND':'',chain&&cards.length>1?'CHAIN REACTION':''].filter(Boolean).join(' · ');
  return {mult,reason};
}
export function burnReward(cards,embers=false){
  const size=cards.length,pileValue=cards.reduce((sum,c)=>sum+cardPoints(c),0);
  if(!size)return {size:0,pileValue:0,mult:1,salvage:0,embers:0,points:0};
  const mult=1+Math.min(4,Math.floor(size/5))*.25;
  const salvage=Math.round(pileValue*.25*mult),extra=embers?size*35:0;
  return {size,pileValue,mult,salvage,embers:extra,points:100+salvage+extra};
}
export function scorePlay(cards,{burnedCards=[],chain=false,embers=false,speedBonus=0}={}){
  const base=cards.reduce((sum,c)=>sum+cardPoints(c),0),combo=comboReward(cards,chain),fire=burnReward(burnedCards,embers);
  return {base,mult:combo.mult,comboReason:combo.reason,handPoints:Math.round(base*combo.mult),burnBonus:fire.points,burnMult:fire.mult,burnSize:fire.size,pileValue:fire.pileValue,salvage:fire.salvage,emberBonus:fire.embers,speedBonus,count:cards.length,points:Math.round(base*combo.mult)+fire.points+speedBonus};
}
// Bonus goals. Each round shows a few; they pay the moment they're done
// (or when you win, for goals marked win). Stats come from engine pstats().
const won = g => g.ended && g.winner === 'player';
const st = g => g.pstats || {};
const of = (n, max) => `${Math.min(n, max)} / ${max}`;
export const GOALS = {
  double: { name: 'DOUBLE CREMATION', points: 500, desc: 'Burn the pile twice this round, with a 10 or four of a kind.', detail: g => of(g.playerBurns || 0, 2), done: g => (g.playerBurns || 0) >= 2 },
  clean: { name: 'CLEAN GETAWAY', points: 750, win: true, desc: 'Win the round without ever picking up the pile.', detail: g => (g.playerPickups === undefined ? 'Tracking begins next round' : (g.playerPickups || 0) > 0 ? 'Pickup taken · try next round' : 'Win without picking up'), done: g => won(g) && g.playerPickups === 0 },
  hattrick: { name: 'HAT TRICK', points: 400, desc: 'Play three cards of the same rank in one go.', detail: g => of(st(g).maxSame || 0, 3), done: g => (st(g).maxSame || 0) >= 3 },
  longrun: { name: 'LONG RUN', points: 500, desc: 'Play four or more cards in a single play. Pairs and suit climbs both count.', detail: g => of(st(g).maxPlay || 0, 4), done: g => (st(g).maxPlay || 0) >= 4 },
  bonfire: { name: 'BONFIRE', points: 600, desc: 'Burn a pile of 8 or more cards.', detail: g => `Biggest burn ${st(g).maxBurn || 0} / 8`, done: g => (st(g).maxBurn || 0) >= 8 },
  quads: { name: 'QUAD SQUAD', points: 700, desc: 'Burn the pile with four of a kind instead of a 10.', detail: g => ((st(g).quadBurns || 0) ? 'Done' : 'Four in a row burns'), done: g => (st(g).quadBurns || 0) >= 1 },
  conjurer: { name: 'CONJURER', points: 600, desc: 'Play all four magic cards this round: a 2, an 8, a 9 and a 10.', detail: g => of((st(g).magic || []).length, 4), done: g => (st(g).magic || []).length >= 4 },
  purist: { name: 'OLD SCHOOL', points: 900, win: true, desc: 'Win the round without playing a single magic card.', detail: g => ((st(g).magicPlays || 0) ? 'Magic played · try next round' : 'No magic so far'), done: g => won(g) && !(st(g).magicPlays || 0) },
  blindluck: { name: 'BLIND LUCK', points: 500, desc: 'Flip two blind cards that turn out playable.', detail: g => of(st(g).blindHits || 0, 2), done: g => (st(g).blindHits || 0) >= 2 },
  comeback: { name: 'COMEBACK KID', points: 800, win: true, desc: 'Pick up 10 or more cards this round, and still win it.', detail: g => `Picked up ${st(g).pickedUp || 0} / 10`, done: g => won(g) && (st(g).pickedUp || 0) >= 10 },
  speedrun: { name: 'SPEED RUN', points: 700, win: true, desc: 'Win the round in 14 plays or fewer.', detail: g => `${st(g).plays || 0} plays so far`, done: g => won(g) && (st(g).plays || 0) <= 14 },
};
// Round 1 keeps the classic pair; later rounds draw three from the pool.
export function pickGoals(round, rand = Math.random) {
  if (round <= 1) return ['double', 'clean'];
  const pool = Object.keys(GOALS).filter(id => !['double', 'clean'].includes(id));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return [rand() < 0.5 ? 'double' : 'clean', ...pool.slice(0, 2)];
}
export function roundGoals(g){
  return (g.goals || ['double', 'clean']).filter(id => GOALS[id]).map(id => {
    const d = GOALS[id];
    return { id, name: d.name, detail: d.detail(g), desc: d.desc, win: !!d.win, complete: !!d.done(g), points: d.points };
  });
}
export function goalReward(g){return roundGoals(g).filter(x=>x.complete).reduce((sum,x)=>sum+x.points,0)}
