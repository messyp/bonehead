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
export function roundGoals(g){
  return [
    {name:'DOUBLE CREMATION',detail:`Burn twice · ${Math.min(2,g.playerBurns||0)} / 2`,complete:(g.playerBurns||0)>=2,points:500},
    {name:'CLEAN GETAWAY',detail:g.playerPickups===undefined?'Tracking begins next round':(g.playerPickups||0)>0?'Pickup taken · try next round':'Win without picking up',complete:g.ended&&g.winner==='player'&&g.playerPickups===0,points:750}
  ];
}
export function goalReward(g){return roundGoals(g).filter(x=>x.complete).reduce((sum,x)=>sum+x.points,0)}
