import {rule,label,source,options} from './engine.js';
export function guidance(g,selected=[]){
  if(g.ended)return 'Round over';
  if(g.turn==='house')return 'House is choosing a card…';
  const phase=source(g.player),r=rule(g.pile);
  if(phase!=='blind'&&g.pile.length&&!options(g,'player').length)return 'No playable cards — pick up the pile';
  if(phase==='blind')return selected.length?'Flip your selected blind card':'Choose a blind card to flip';
  const instruction=!r.r?'Play any card':r.low?'Play a 9 or lower · or a magic card':`Play a ${label(r.r)} or higher · or a magic card`;
  return selected.length?`${selected.length} selected — ${instruction.toLowerCase()}`:instruction;
}
