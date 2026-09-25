import {roundGoals} from './scoring.js';
export function claimGoals(g){
  // Old saved results already include their goal payout.
  if(!g.paidGoals)g.paidGoals=g.goalBonus!==undefined?roundGoals(g).filter(x=>x.complete).map(x=>x.name):[];
  const earned=roundGoals(g).filter(x=>x.complete&&!g.paidGoals.includes(x.name));
  g.paidGoals.push(...earned.map(x=>x.name));return earned;
}
export const trophies={
 triple:{name:'Three’s a Crowd',detail:'Play three cards of the same rank in one move.',rarity:'BRONZE'},
 beast:{name:'Number of the Beast',detail:'Play three sixes in one move.',rarity:'RARE'},
 inferno:{name:'Ashes to Ashes',detail:'Burn at least 10 cards in one pile.',rarity:'SILVER'},
 clean:{name:'Untouchable',detail:'Win a round without picking up.',rarity:'GOLD'},
 circuit:{name:'Death Cheater',detail:'Win every round of a run.',rarity:'GOLD'}
};
export function earnedTrophies(g,result){
 const ids=[],c=result?.cards||[];
 if(!result?.pickup&&!result?.protected&&c.length===3&&c.every(x=>x.r===c[0].r)){ids.push('triple');if(c[0].r===6)ids.push('beast')}
 if(result?.burn&&result.size>=10)ids.push('inferno');
 if(g.ended&&g.winner==='player'){if(g.playerPickups===0)ids.push('clean');if(g.round===(g.finalRound||3))ids.push('circuit')}
 return ids;
}
export function exchangeHand(g,kind,id,random=Math.random){
 if(g.ended||g.turn!=='player'||!['reshuffle','swap'].includes(kind)||!(g.items?.[kind]>0))return null;
 const old=kind==='swap'?g.player.hand.filter(c=>c.id===id):[...g.player.hand];
 if(!old.length||g.deck.length<old.length)return null;
 const fresh=[];
 for(const c of old){const i=Math.floor(random()*g.deck.length);fresh.push(g.deck.splice(i,1)[0]);}
 g.player.hand=g.player.hand.map(c=>{const i=old.findIndex(x=>x.id===c.id);return i<0?c:fresh[i]});
 g.deck.push(...old);for(let i=g.deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[g.deck[i],g.deck[j]]=[g.deck[j],g.deck[i]]}
 g.items[kind]--;return {old,fresh};
}
