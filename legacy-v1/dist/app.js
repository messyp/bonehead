import {claimGoals,trophies,earnedTrophies,exchangeHand} from './progression.js';
import {cardOverPile} from './gestures.js';
import {guidance} from './guidance.js';
import {ART_STYLES,brandMarkup} from './appearance.js';
import {cardPoints,comboReward,scorePlay,roundGoals,goalReward} from './scoring.js';
import {SUITS,label,magic,rule,legal,source,valid,deal,options,play,pickup} from './engine.js';
const $=id=>document.getElementById(id), total=p=>p.hand.length+p.face.length+p.blind.length;
const opponents=[
  {name:'Lucky Bones',portrait:'assets/dealer.png',venue:'THE BACK ROOM'},
  {name:'The Velvet Reaper',portrait:'assets/velvet-reaper.png',venue:'THE VELVET FLOOR'},
  {name:'The Pit Boss',portrait:'assets/dealer.png',venue:'THE LAST CHANCE'}
];
function opponentForRound(){return opponents[Math.min(opponents.length-1,Math.max(0,g.round-1))]}
const defaults={minHand:3,aiDelay:1300,timeBonus:8,extraMagic:0,aiSkill:0,animations:true};
const safeRead=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const artStyle='v1';
document.documentElement.dataset.art='v1';
$('brand').innerHTML=brandMarkup('v1');
const flickOrigins=new Map();let dragState=null,suppressCardClickUntil=0;
let tallyActive=false,displayScore=0,tutorialStep=0,tutorialStartsRun=false;
let previousPlayerPhase='hand',previousHousePhase='hand';
let moving=false,moveLabel='',queuedModal=null,playerCardSize={width:120,height:168};
let dealRun=0;
let previousHandIds=new Set(),previousPileId='',resultTimer=null;
let config={...defaults,...safeRead('ll-config',{})},muted=safeRead('ll-muted',false),best=safeRead('ll-best',0),g=deal(),selected=[],score=0,tricks=[],rewardChoices=[],shields=0,elapsed=0,started=false,busy=false,sortSuit=false,logs=[],pending=null,modalKind='',aiTimer=null,startedMove=Date.now(),audioCtx,musicTimer,beat=0,modalFocus,dealNoiseBuffer;
const persist=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
function save(){if(started&&!moving)persist('ll-save',{g,score,tricks,rewardChoices,shields,elapsed,logs,pending,config})}
function tone(freq,dur=.1,type='square',vol=.035,delay=0){if(muted)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();let osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(vol,audioCtx.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+delay+dur);osc.connect(gain);gain.connect(audioCtx.destination);osc.start(audioCtx.currentTime+delay);osc.stop(audioCtx.currentTime+delay+dur)}catch{}}
function dealFlick(index=0){
  if(muted)return;
  try{
    audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();
    const now=audioCtx.currentTime,duration=.048,sampleRate=audioCtx.sampleRate;
    if(!dealNoiseBuffer){
      dealNoiseBuffer=audioCtx.createBuffer(1,Math.ceil(sampleRate*.09),sampleRate);
      const data=dealNoiseBuffer.getChannelData(0);
      for(let i=0;i<data.length;i++){const t=i/data.length;data[i]=(Math.random()*2-1)*(1-t)*(.7+.3*Math.random());}
    }
    const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
    source.buffer=dealNoiseBuffer;source.playbackRate.value=.88+(index%5)*.045;filter.type='bandpass';filter.frequency.value=2350+(index%4)*140;filter.Q.value=.8;
    gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.11,now+.002);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);source.start(now);source.stop(now+duration+.01);
    tone(380+(index%4)*25,.022,'triangle',.016);
  }catch{}
}
// A soft falling chord and sub thump mark a setback before cards move.
function pickupSound(){
  if(muted)return;
  try{
    audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();
    const now=audioCtx.currentTime;
    [196,233.08,293.66].forEach((frequency,i)=>{
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();
      osc.type='triangle';osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(frequency*.46,now+.48);
      filter.type='lowpass';filter.frequency.setValueAtTime(950,now);filter.frequency.exponentialRampToValueAtTime(180,now+.6);
      gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.045,now+.025+i*.008);gain.gain.exponentialRampToValueAtTime(.001,now+.65);
      osc.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);osc.start(now);osc.stop(now+.7);
    });
    tone(58,.4,'sine',.09,.08);
  }catch{}
}
function sound(kind){if(kind==='pickup'){pickupSound()}else if(kind==='burn'){[110,73,55,36].forEach((n,i)=>tone(n,.35,'sawtooth',.07,i*.08));[440,660,880].forEach((n,i)=>tone(n,.18,'square',.03,.15+i*.09))}else if(kind==='win'){[262,330,392,523,660,784].forEach((n,i)=>tone(n,.25,'triangle',.09,i*.12))}else if(kind==='ghost'){[700,1046,1400].forEach((n,i)=>tone(n,.3,'sine',.04,i*.08))}else if(kind==='bad'){tone(140,.18,'sawtooth');tone(95,.25,'sawtooth',.03,.12)}else{tone(kind==='select'?540:310,.06,'triangle',.07);if(kind==='play')tone(620,.08,'triangle',.04,.06)}}
let musicVolume=Math.max(0,Math.min(.5,safeRead('ll-music-volume',.12))),tracks=[],activeTrack=0,crossfade=false;
function music(){
  if(!tracks.length){tracks=[new Audio('assets/dreams.mp3'),new Audio('assets/dreams.mp3')];tracks.forEach(t=>{t.preload='auto';t.volume=0;t.loop=true;t.addEventListener('error',()=>{$('sound').title='Music could not load. Sound effects are still available.'})});}
  if(!document.hidden&&started&&musicVolume>0)tracks[activeTrack].play().catch(()=>{});
  if(musicTimer)return;
  musicTimer=setInterval(()=>{
    if(!started||document.hidden||musicVolume===0){tracks.forEach(t=>t.pause());return}
    const a=tracks[activeTrack],b=tracks[1-activeTrack],level=musicVolume*(modalKind&&modalKind!=='audio'?.4:1);
    if(a.paused)a.play().catch(()=>{});
    const remaining=a.duration-a.currentTime;
    if(!crossfade&&Number.isFinite(remaining)&&remaining<5){crossfade=true;b.currentTime=0;b.volume=0;b.play().catch(()=>{});}
    if(crossfade){if(b.paused)b.play().catch(()=>{});const mix=Math.min(1,b.currentTime/5);a.volume=level*(1-mix);b.volume=level*mix;if(mix>=1||a.currentTime<1){a.pause();a.currentTime=0;activeTrack=1-activeTrack;crossfade=false;}}
    else{a.volume=level*Math.min(1,a.currentTime/2);b.volume=0;}
  },100);
}
function audioSettings(){open(`<button class="close" data-action="return" aria-label="Close audio settings">×</button><div class="eyebrow">THE DREAM FREQUENCY</div><h2>Set the mood.</h2><label class="audio-row">Background music <input id="musicvolume" type="range" min="0" max="50" value="${Math.round(musicVolume*100)}"><output id="musicvalue">${Math.round(musicVolume*100)}%</output></label><label class="audio-row">Card sounds & effects <input id="effectsenabled" type="checkbox" ${muted?'':'checked'}></label><div class="music-credit"><b>Dreams Become Real</b><p>Kevin MacLeod (<a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500027" target="_blank" rel="noopener">incompetech.com</a>)<br>Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">Creative Commons: By Attribution 4.0</a>.<br>Atmospheric piano and hidden synth textures. Played quietly with a loop crossfade.</p></div><button class="primary" data-action="return">${started?'BACK TO THE TABLE':'BACK'}</button>`,'audio');music();}
function card(c,{back=false,active=false,mini=false}={}){if(back)return `<button data-ref="${c.id}" class="card back ${active?'playable':''}" ${active?`data-card="${c.id}" aria-label="Reveal blind card"`:'tabindex="-1" aria-hidden="true"'}><span class=back-emblem aria-hidden=true></span></button>`;let chosen=selected.indexOf(c.id),sel=chosen>=0,can=active&&(source(g.player)==='blind'||valid([...selected.map(id=>g.player[source(g.player)].find(x=>x.id===id)).filter(Boolean),c],g.pile));return `<button data-ref="${c.id}" class="card ${c.s%2?'red':''} ${magic[c.r]?`special magic-${c.r}`:''} ${sel?'selected':''} ${active?(can||sel?'playable':'unplayable'):''}" ${active?`data-card="${c.id}" aria-pressed="${sel}"`:'tabindex="-1"'} data-order="${chosen+1}" aria-label="${label(c.r)} of ${['spades','hearts','clubs','diamonds'][c.s]}${magic[c.r]?', '+magic[c.r][0]:''}" title="${magic[c.r]?.[1]||label(c.r)+' of '+['spades','hearts','clubs','diamonds'][c.s]} · ${cardPoints(c)} points"><span class="corner">${label(c.r)}<small class="corner-suit suit-${c.s}" aria-hidden="true">${SUITS[c.s]}</small></span><span class="pip suit-${c.s}">${({2:'↻',8:'◇',9:'⇣',10:'✹'})[c.r]||SUITS[c.s]}</span>${magic[c.r]?`<span class="cardname">${magic[c.r][0]}</span>`:`<span class="corner bottom">${label(c.r)}<small class="corner-suit suit-${c.s}" aria-hidden="true">${SUITS[c.s]}</small></span>`}</button>`}
function pairedTable(player,active){return Array.from({length:Math.max(player.face.length,player.blind.length)},(_,i)=>`<div class="table-pair">${player.blind[i]?`<div class="locked-blind" aria-label="Blind card locked until all face-up cards are gone">${card(player.blind[i],{back:true})}<span class="blind-lock">LOCKED</span></div>`:''}${player.face[i]?card(player.face[i],{active}):''}</div>`).join('');}
function render(){const reservePositions=new Map([...document.querySelectorAll('#tablecards [data-ref],#housetable [data-ref]')].map(el=>[el.dataset.ref,el.getBoundingClientRect()]));$('time').textContent=formatTime(elapsed);let src=g.deck.length?'hand':source(g.player),turn=g.turn==='player'&&!busy&&!g.ended;let cards=[...g.player[src]];cards.sort(sortSuit?(a,b)=>a.s-b.s||a.r-b.r:(a,b)=>a.r-b.r||a.s-b.s);$('round').textContent=String(g.round).padStart(2,'0');$('venue').textContent=['THE BACK ROOM','THE VELVET FLOOR','THE LAST CHANCE'][g.round-1];$('stake').textContent=['A friendly game. Allegedly.','The house is learning your tricks.','One final seat. Make it count.'][g.round-1];const opponent=opponentForRound();$('dealername').textContent=opponent.name;const portrait=document.querySelector('.dealer-avatar img');if(portrait.getAttribute('src')!==opponent.portrait)portrait.src=opponent.portrait;portrait.alt=opponent.name;document.querySelectorAll('.route i').forEach((e,i)=>e.classList.toggle('active',i<g.round));$('score').textContent=(tallyActive?displayScore:score).toLocaleString();$('best').textContent=best.toLocaleString();$('burncount').textContent=g.burns;$('ashcount').textContent=g.cardsBurned||0;$('deckcount').textContent=g.deck.length;$('housecount').textContent=total(g.house);const houseSrc=g.deck.length?'hand':source(g.house);$('housecards').innerHTML=houseSrc==='face'?pairedTable(g.house,false):g.house[houseSrc].slice(0,16).map(c=>card(c,{back:houseSrc!=='face'})).join('');
$('househandlabel').textContent=`${houseSrc==='hand'?'HAND':houseSrc==='face'?'TABLE IN PLAY':'BLIND CARDS'} · ${g.house[houseSrc].length}`;
$('housetable').innerHTML=Array.from({length:3},(_,i)=>`<div class="house-slot">${houseSrc==='hand'&&g.house.blind[i]?card(g.house.blind[i],{back:true}):''}${houseSrc==='hand'&&g.house.face[i]?card(g.house.face[i]):''}</div>`).join('');
$('housetablelabel').textContent=houseSrc==='hand'?`TABLE · ${g.house.face.length} UP / ${g.house.blind.length} BLIND`:'RESERVES IN PLAY';
renderPiles();let r=rule(g.pile);$('pilelabel').textContent=(r.r?r.low?'9 OR LOWER':`${label(r.r)} OR HIGHER`:'PLAY ANY CARD')+(g.pile.length?` · ${g.pile.length} IN PILE`:'');$('hand').innerHTML=(src==='face'?pairedTable(g.player,true):cards.map(c=>card(c,{back:src==='blind',active:true})).join(''))||(moving&&g.deck.length?'<p class=dealing-note>Dealing your next cards…</p>':'<p>Not a card to your name.</p>');$('hand').querySelectorAll('[data-card]').forEach(el=>{if(previousHandIds.has(el.dataset.card))el.style.animation='none'});previousHandIds=new Set(cards.map(c=>c.id));const pileId=g.pile.at(-1)?.id||'';if(pileId===previousPileId)$('pile').querySelectorAll('.card').forEach(el=>el.style.animation='none');previousPileId=pileId;$('hand').classList.toggle('crowded',cards.length>5);const visibleCard=$('hand').querySelector('.card');if(visibleCard)playerCardSize={width:visibleCard.offsetWidth,height:visibleCard.offsetHeight};$('handcount').textContent=`${cards.length} ${src==='hand'?'cards in hand':src==='face'?'table cards':'blind cards'}`;$('turnlabel').textContent=moving?moveLabel:g.ended?'ROUND OVER':turn?'YOUR MOVE':'HOUSE IS THINKING';$('phasehint').textContent=src==='hand'?'Saved for the last act':src==='face'?'Blinds locked underneath':'Trust your luck.';['hand','face','blind'].forEach(s=>$('step-'+s).classList.toggle('active',s===src));$('tablecards').innerHTML=Array.from({length:3},(_,i)=>`<div class="slot">${src==='hand'&&g.player.blind[i]?card(g.player.blind[i],{back:true}):''}${src==='hand'&&g.player.face[i]?card(g.player.face[i]):''}</div>`).join('');$('play').disabled=!turn||!selected.length;$('play').innerHTML=src==='blind'?'FLIP CARD <span>↗</span>':'PLAY CARDS <span>↗</span>';$('selectionhint').textContent=selected.length?`${selected.length} selected${selected.length>1?` · ×${multiplier(selected.length).toFixed(2)} run bonus`:''}`:src==='blind'?'Choose a blind card. Fortune favours the bold.':src==='face'?'Play all face-up cards. Blinds stay locked underneath.':'Select cards in the order you want to play.';renderTricks();if(!tallyActive)renderScoreBreakdown();$('lastdetails').hidden=!g.lastHand;$('lastscore').textContent=g.lastHand?'+'+g.lastHand.points.toLocaleString():'—';$('lastlabel').textContent=g.lastHand?.label||'Play your first card';$('roundgoals').innerHTML=roundGoals(g).map(x=>`<div class="round-goal ${x.complete?'complete':''}"><b>${x.complete?'✓':'◇'} ${x.name}</b><p>${x.detail}</p><span>${g.paidGoals?.includes(x.name)?'PAID · ':''}+${x.points}</span></div>`).join('');$('sound').innerHTML='♪ <span>AUDIO</span>'; $('sort').disabled=busy; $('sort').textContent=sortSuit?'SORT: SUIT ↕':'SORT: RANK ↕';
const mustPickup=mustPickUp();
$('play').classList.toggle('pickup-action',mustPickup);
$('play').disabled=!turn||moving||(!mustPickup&&!selected.length);
if(mustPickup)$('play').innerHTML='PICK UP PILE <span>↓</span>';
if(mustPickup){$('selectionhint').textContent='No playable cards. Pick up the pile.';$('turnlabel').textContent='PICK UP THE PILE';}
$('hand').classList.toggle('reserve-active',src!=='hand');$('housecards').classList.toggle('reserve-active',houseSrc!=='hand');
if(src!==previousPlayerPhase&&src!=='hand')enterReserve($('hand'),reservePositions);
if(houseSrc!==previousHousePhase&&houseSrc!=='hand')enterReserve($('housecards'),reservePositions);
for(const id of flickOrigins.keys()){const el=$('hand').querySelector(`[data-card="${id}"]`);if(el)el.style.visibility='hidden'}previousPlayerPhase=src;previousHousePhase=houseSrc;syncTurnUI();save()}
function enterReserve(container,positions){if(!motionOn())return;for(const el of container.querySelectorAll('[data-ref]')){const from=positions.get(el.dataset.ref),to=el.getBoundingClientRect();if(!from||!to.width)continue;el.style.transformOrigin='top left';el.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`,opacity:.6},{transform:'translate(0,0) scale(1)',opacity:1}],{duration:600,easing:'cubic-bezier(.16,1,.3,1)'});}}
function syncTurnUI(){
  const table=document.querySelector('.table');
  table.dataset.activePlayer=!started||g.ended||moveLabel.startsWith('DEALING TABLE')||moveLabel==='DEALING HANDS'?'none':g.turn;
  $('turnlabel').textContent='YOUR CARDS';
  if(!moving){$('announcement').textContent=guidance(g,selected);$('announcement').classList.remove('toast')}
  $('pilelabel').textContent=g.pile.length?`${g.pile.length} IN PILE`:'';
}
function log(t){logs.unshift(t);logs=logs.slice(0,20)}
function tell(t,bad=false){$('announcement').textContent=bad||moving?t:guidance(g,selected);$('announcement').classList.toggle('toast',bad)}
function multiplier(n){const cards=selected.map(id=>g.player[source(g.player)].find(c=>c.id===id)).filter(Boolean);return comboReward(cards,tricks.includes('chain')).mult}
function showEffect(type,title,sub){if(!config.animations)return;const e=document.createElement('div');e.className='effect '+type;e.innerHTML=`${title}<small>${sub}</small>`;document.querySelector('.table').appendChild(e);setTimeout(()=>e.remove(),1500);if(type==='burn'){let t=document.querySelector('.table');t.classList.add('shake');setTimeout(()=>t.classList.remove('shake'),400);let rect=$('pile').getBoundingClientRect();for(let i=0;i<40;i++){let p=document.createElement('i');p.className='particle';p.style.cssText=`left:${rect.x+rect.width/2}px;top:${rect.y+rect.height/2}px;--x:${(Math.random()-.5)*650}px;--y:${(Math.random()-.5)*500}px;background:${['#ff9e50','#f6e3a7','#b5ebae','#e96a3c'][i%4]}`;$('particles').appendChild(p);setTimeout(()=>p.remove(),1000)}}}
function select(id){$('hand').classList.remove('needs-nudge');if(!started||g.turn!=='player'||busy||g.ended)return;const src=source(g.player),c=g.player[src].find(c=>c.id===id);if(!c)return;if(selected.includes(id)){selected=selected.slice(0,selected.indexOf(id));sound('select')}else{let next=src==='blind'?[id]:[...selected,id];if(src!=='blind'&&!valid(next.map(x=>g.player[src].find(c=>c.id===x)),g.pile)){tell(selected.length?'Link equal ranks or the next card in the same suit.':'That card cannot beat the pile. Choose a brighter card or a magic card.',true);sound('bad');return}selected=next;sound('select');tell(src==='blind'?'No peeking. Ready when you are.':selected.length>1?'A little momentum goes a long way.':'Looking good.')}render()}
// The engine decides the result once. This visual transaction shows each step
// before committing that result and unlocking the next turn.
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function motionOn(){return config.animations&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
function rect(el){return (el||$('pile')).getBoundingClientRect();}
function renderPiles(){
  let count=g.pile.length,layers=Math.min(14,count);
  $('pile').innerHTML=count?Array.from({length:layers},(_,i)=>{let c=g.pile[count-layers+i],depth=layers-1-i;return `<div class="stack-card" style="--depth:${depth};--tilt:${i===layers-1?-3:(i%3-1)*3}deg">${card(c)}</div>`}).join(''):'<div class="empty-pile">✦<span>THE FLOOR IS YOURS</span></div>';
  $('pile').dataset.count=count;
  renderDraw(g.deck.length);
}
function renderDraw(count){
  $('deckcount').textContent=count;
  $('drawstack').innerHTML=count?Array.from({length:Math.min(20,Math.ceil(count/2))},(_,i)=>`<div class="draw-layer" style="--depth:${i}">${card({id:'draw-'+i},{back:true})}</div>`).join(''):'<div class="deck-empty">DECK<br>EMPTY</div>';
}
async function flyCard(c,from,to,{back=false,duration=360,flip=false}={}){
  const holder=document.createElement('div');holder.innerHTML=card(c,{back});const el=holder.firstElementChild;
  el.classList.remove('selected','unplayable','playable');el.classList.add('flying-card');el.removeAttribute('data-card');el.setAttribute('aria-hidden','true');el.tabIndex=-1;
  el.style.cssText=`position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;min-width:0;margin:0;z-index:60;pointer-events:none;animation:none;transform:none;transform-origin:top left;`;
  document.body.appendChild(el);let dx=to.left-from.left,dy=to.top-from.top,sx=to.width/from.width,sy=to.height/from.height;
  if(motionOn()&&el.animate){const a=el.animate([{transform:'translate(0,0) rotate(0deg) scale(1)'},{transform:`translate(${dx*.52}px,${dy*.5-45}px) rotate(${dx>0?7:-7}deg) scale(${1+(sx-1)*.5},${1+(sy-1)*.5})`,offset:.52},{transform:`translate(${dx}px,${dy}px) rotate(-3deg) scale(${sx},${sy})`}],{duration,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});try{await a.finished}catch{}}else await sleep(45);
  el.remove();
}
function openingDealItems(){
  const items=[];
  const add=(selector,cards,back)=>cards.forEach(c=>{
    if(!c)return;
    const el=document.querySelector(`${selector} [data-ref="${c.id}"]`);
    if(el)items.push({c,el,back});
  });
  // Deal the six table cards first, alternating around the table so the
  // player can see the reserve phase being built before hands arrive.
  for(let i=0;i<3;i++){
    add('#housetable',[g.house.blind[i]],true);
    add('#tablecards',[g.player.blind[i]],true);
    add('#housetable',[g.house.face[i]],false);
    add('#tablecards',[g.player.face[i]],false);
  }
  // Then deal the visible hands, again alternating house and player cards.
  for(let i=0;i<Math.max(g.house.hand.length,g.player.hand.length);i++){
    add('#housecards',[g.house.hand[i]],true);
    add('#hand',[g.player.hand[i]],false);
  }
  return items;
}
async function introduceOpponent(){
  const opponent=opponentForRound(),layer=document.createElement('div');
  const app=$('app'),previousFocus=document.activeElement,wasInert=app.inert;
  layer.className='opponent-introduction';
  layer.innerHTML=`<section class="opponent-intro-panel" role="dialog" aria-modal="true" aria-labelledby="opponent-intro-name" tabindex="-1"><div class="eyebrow">ROUND ${g.round} OF 3 · ${opponent.venue}</div><img src="${opponent.portrait}" alt=""><p>YOUR OPPONENT</p><h2 id="opponent-intro-name">${opponent.name}</h2><span class="opponent-intro-note">First to lose every card wins.</span><button class="opponent-intro-skip">DEAL NOW</button></section>`;
  document.body.appendChild(layer);app.inert=true;
  const panel=layer.firstElementChild;panel.focus({preventScroll:true});
  let timer,advance;
  const proceed=new Promise(resolve=>{advance=resolve;timer=setTimeout(resolve,1800)});
  layer.querySelector('button').onclick=advance;
  const keys=e=>{if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();e.stopPropagation();advance()}if(e.key==='Tab'){e.preventDefault();e.stopPropagation();layer.querySelector('button').focus()}};
  layer.addEventListener('keydown',keys,true);
  try{
    await proceed;clearTimeout(timer);
    const target=document.querySelector('.opponent'),from=panel.getBoundingClientRect(),to=target.getBoundingClientRect();
    if(motionOn()&&panel.animate){
      const scale=Math.min(.4,to.height/from.height),dx=to.left+Math.min(to.width,250)/2-(from.left+from.width/2),dy=to.top+to.height/2-(from.top+from.height/2);
      layer.classList.add('docking');
      const animation=panel.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(${scale})`,opacity:.9,offset:.84},{transform:`translate(${dx}px,${dy}px) scale(${scale})`,opacity:0}],{duration:650,easing:'cubic-bezier(.55,0,.2,1)',fill:'forwards'});
      await animation.finished.catch(()=>{});
      target.classList.remove('opponent-arrived');void target.offsetWidth;target.classList.add('opponent-arrived');
    }
  }finally{clearTimeout(timer);layer.remove();app.inert=wasInert;previousFocus?.focus?.({preventScroll:true})}
}
async function startOpeningDeal(){
  const run=++dealRun;
  moving=true;busy=true;moveLabel='DEALING TABLE CARDS';render();
  const items=openingDealItems(),staged=[];
  items.forEach(({el})=>el.style.visibility='hidden');
  const drawSource=()=>rect($('drawstack').querySelector('.draw-layer:last-child .card')||$('drawstack'));
  let remaining=g.deck.length+items.length;renderDraw(remaining);
  const launch=async(item,index,target,reveal)=>{
    const from=drawSource();dealFlick(index);renderDraw(--remaining);
    await flyCard(item.c,from,target,{back:item.back,duration:190});
    if(run===dealRun)reveal();
  };
  try{
    await introduceOpponent();
    if(run!==dealRun)return;
    if(motionOn()){
      // A single card leaves every 65ms. Flights overlap, launch sounds never pair.
      const flights=[];
      for(let i=0;i<12;i++){
        const item=items[i],house=item.el.closest('#housetable'),lane=rect($(house?'housecards':'hand'));
        const width=playerCardSize.width,height=playerCardSize.height;
        const column=Math.floor(i/4),blind=i%4<2;
        const target={left:lane.left+lane.width/2+(column-1)*(width+10)-width/2+(blind?4:0),top:lane.top+(lane.height-height)/2+(blind?8:0),width,height};
        const holder=document.createElement('div');holder.innerHTML=card(item.c,{back:item.back});const el=holder.firstElementChild;
        el.classList.add('opening-card');el.style.cssText=`position:fixed;left:${target.left}px;top:${target.top}px;width:${width}px;height:${height}px;min-width:0;z-index:${blind?61:62};pointer-events:none;visibility:hidden;transform:none;animation:none;`;
        document.body.appendChild(el);staged.push({el,item});
        flights.push(launch(item,i,target,()=>el.style.visibility=''));await sleep(65);
      }
      await Promise.all(flights);await sleep(180);
      $('announcement').textContent='TABLE CARDS SAVED FOR THE LAST ACT';
      await Promise.all(staged.map(async({el,item})=>{
        const from=rect(el);el.remove();await flyCard(item.c,from,rect(item.el),{back:item.back,duration:340});item.el.style.visibility='';
      }));
      $('turnlabel').textContent='DEALING HANDS';$('announcement').textContent='YOUR HAND · READY TO PLAY';
      const hands=[];
      for(let i=12;i<items.length;i++){
        const item=items[i];hands.push(launch(item,i,rect(item.el),()=>item.el.style.visibility=''));await sleep(65);
      }
      await Promise.all(hands);
    }
  }catch(error){console.error('Opening deal animation failed',error);}
  finally{
    staged.forEach(({el})=>el.remove());items.forEach(({el})=>el.style.visibility='');
    if(run===dealRun){tell('Select a card, then play. Or drag it into the pile.');endMove();}
  }
}

function origin(who,c,src){return who==='player'?$('hand').querySelector(`[data-ref="${c.id}"]`):($('housecards').querySelector(`[data-ref="${c.id}"]`)||$('housetable').querySelector(`[data-ref="${c.id}"]`))}
function pileTarget(){const r=rect($('pile'));return {left:r.left,top:r.top,width:r.width,height:r.height};}
function handTarget(who){let el=$(who==='player'?'hand':'housecards'),r=rect(el);let sample=el.querySelector('.card'),w=sample?.offsetWidth||(who==='player'?playerCardSize.width:55),h=sample?.offsetHeight||(who==='player'?playerCardSize.height:78);return {left:r.left+r.width/2-w/2,top:r.top+(r.height-h)/2,width:w,height:h};}
function lockMove(labelText){$('hand').classList.remove('needs-nudge');moving=true;busy=true;moveLabel=labelText;render();}
function endMove(){flickOrigins.clear();moving=false;busy=false;moveLabel='';selected=[];render();if(queuedModal){const next=queuedModal;queuedModal=null;next();if(g.ended)finish();return}if(g.ended)finish();else if(g.turn==='house')queueAI();else startedMove=Date.now();}
async function collectPile(who,reason){
  const count=g.pile.length;if(!count)return;
  if(who==='player')sound('pickup');
  tell(`${who==='house'?'HOUSE':'YOU'} PICK${who==='house'?'S':''} UP ${count} CARDS · ${reason}`,who==='player');
  moveLabel=who==='house'?'HOUSE PICKS UP':'PICKING UP';render();
  await sleep(motionOn()?650:180);
  while(g.pile.length){const c=g.pile.at(-1),from=pileTarget();g.pile.pop();g[who].hand.push(c);render();const dest=$(who==='player'?'hand':'housecards').querySelector(`[data-ref="${c.id}"]`),target=dest?rect(dest):handTarget(who);if(dest)dest.style.visibility='hidden';await flyCard(c,from,target,{back:who==='house',duration:Math.max(85,230-count*4)});if(dest)dest.style.visibility='';sound('select');}
}
async function animatePlay(who,ids){
  if(moving||g.ended)return;
  const next=structuredClone(g),src=source(next[who]);
  const result=play(next,who,ids,config.minHand,who==='player'&&shields>0);
  if(result.error){tell(result.error,true);sound('bad');return}
  result.pickupCount=g.pile.length+result.cards.length;const you=who==='player',actor=you?'YOU':'HOUSE',cards=result.cards;
  lockMove(`${actor} ${src==='blind'?'FLIPS':'PLAYS'}`);
  try{
    for(let i=0;i<cards.length;i++){
      const c=cards[i];tell(`${actor} ${src==='blind'?'FLIPS':'PLAYS'} ${label(c.r)}${SUITS[c.s]}${cards.length>1?` · RUN ${i+1} OF ${cards.length}`:''}`);
      const el=origin(who,c,src),from=who==='player'&&flickOrigins.has(c.id)?flickOrigins.get(c.id):rect(el||$(who==='player'?'hand':'housecards'));flickOrigins.delete(c.id);if(el)el.style.visibility='hidden';
      if(src==='blind'){await flyCard(c,from,pileTarget(),{back:true});const reveal=document.createElement('div');reveal.innerHTML=card(c);reveal.className='blind-reveal';$('pile').appendChild(reveal);sound('ghost');await sleep(motionOn()?430:100);reveal.remove();}
      else await flyCard(c,from,pileTarget());
      g[who][src]=g[who][src].filter(x=>x.id!==c.id);g.pile.push(c);selected=selected.filter(id=>id!==c.id);render();sound('play');
      if(cards.length>1)await sleep(motionOn()?200:70);
    }
    if(result.pickup){await collectPile(who,'BLIND CARD CANNOT PLAY');}
    else if(result.protected){tell('SECOND CHANCE · BAD FLIP DISCARDED');showEffect('ghost','SAVED','KEEP THE PILE · GO AGAIN');g.pile.pop();shields--;render();await sleep(motionOn()?750:150);if(total(next.player)===0){next.ended=true;next.winner='player';}}
    else if(result.burn){
      const reason=cards.at(-1).r===10?'10 PLAYED':`FOUR ${label(cards.at(-1).r)}s IN A ROW`;
      tell(`${actor} BURNS THE PILE · ${reason}`);moveLabel=`${actor} BURNS`;render();await sleep(motionOn()?650:200);
      await firePile();showEffect('ash','DUSTED.',`${reason} · ${actor} GO${you?'':'ES'} AGAIN`);
      g.pile=[];g.burns=next.burns;g.cardsBurned=next.cardsBurned;render();await sleep(motionOn()?300:80);
    }
    if(!result.pickup&&!result.protected){
      const drawn=next[who].hand.filter(c=>!g[who].hand.some(x=>x.id===c.id));
      for(let i=0;i<drawn.length;i++){let c=drawn[i];moveLabel=`DEALING TO ${actor}`;tell(`${actor} DRAW${you?'':'S'} ${i+1} OF ${drawn.length} · BACK TO ${config.minHand} CARDS`);const from=rect($('drawstack').querySelector('.draw-layer:last-child .card')||$('drawstack'));g.deck.pop();g[who].hand.push(c);render();const dest=$(who==='player'?'hand':'housecards').querySelector(`[data-ref="${c.id}"]`),target=dest?rect(dest):handTarget(who);if(dest)dest.style.visibility='hidden';dealFlick(i);await flyCard(c,from,target,{back:who==='house',duration:300});if(dest)dest.style.visibility='';await sleep(motionOn()?100:30);}
    }
    g=next;
    await summarizeMove(who,result);if(who==='player'){checkTrophies(result);const earned=payGoals();if(earned.length)await sleep(motionOn()?1000:0);}
  }catch(error){console.error('Turn animation failed',error);g=next;tell('Move completed. Your table is up to date.');document.querySelectorAll('.flying-card').forEach(e=>e.remove());}
  endMove();
}
async function summarizeMove(who,result){const you=who==='player',actor=you?'You':'House',cards=result.cards;
  if(result.pickup){log(`${actor} failed a blind flip and picked up ${result.pickupCount} cards.`);tell(`${actor} picked up the pile. ${you?'House plays next.':'Your move.'}`);return}
  if(result.protected){log('Second Chance discarded your failed blind flip.');tell('Second Chance saved your flip. Go again.');return}
  let points=0;let rank=cards.at(-1)?.r;const why=rank===8?'8 is transparent. Previous rule stays.':rank===2?'2 resets. Anything goes.':rank===9?'9 undercuts. Next card 9 or lower.':'';
  // Put the magic callout on screen before the score counter starts.
  if(!result.burn&&!result.protected&&[2,8,9].includes(rank)){showEffect(rank===8?'ghost':rank===2?'reset':'under',rank===8?'SEE THROUGH':rank===2?'FRESH START':'GO LOWER',why);sound('ghost');}
  if(you){
    const speedBonus=Math.max(0,5-Math.floor((moveSubmittedAt-startedMove)/1000))*config.timeBonus;
    const award=scorePlay(cards,{burnedCards:result.burnedCards||[],chain:tricks.includes('chain'),embers:tricks.includes('embers'),speedBonus});
    points=award.points;score+=points;
    g.lastHand={...award,cardValues:cards.map(c=>`${label(c.r)}${SUITS[c.s]} ${cardPoints(c)}`).join(' + '),label:award.comboReason};
    await tallyPoints(points,award);
  }
  const chain=cards.map(c=>label(c.r)+SUITS[c.s]).join(' → ');log(`${actor}: ${chain}${you?` · +${points}`:''}${result.burn?' · '+(cards.at(-1).r===10?'10 burns':'four of a kind burns'):''}`);
  if(result.burn){tell(`${actor} burned ${result.size} cards: ${cards.at(-1).r===10?'10 played':'four matching ranks'}. ${you?'Go again!':'House goes again.'}`);}
  else{tell(`${actor}: ${chain}${you?' · +'+points:''}. ${why|| (g.turn==='player'?'Your move.':'House plays next.')}`);}
}
let moveSubmittedAt=Date.now();
function mustPickUp(){return started&&!busy&&!moving&&!g.ended&&g.turn==='player'&&g.pile.length>0&&source(g.player)!=='blind'&&!options(g,'player').length}
function playerPlay(){if(dragState||!started||g.turn!=='player'||busy||moving||g.ended||modalKind)return;if(mustPickUp()){selected=[];animatePickup('player');return}if(!selected.length)return;moveSubmittedAt=Date.now();animatePlay('player',[...selected]);}
async function animatePickup(who){if(moving||!g.pile.length)return;const next=structuredClone(g),count=g.pile.length;if(!pickup(next,who))return;lockMove(who==='house'?'HOUSE PICKS UP':'PICKING UP');try{await collectPile(who,who==='house'?'NO PLAYABLE CARD':'NO PLAYABLE CARD');}finally{g=next;log(`${who==='house'?'House had no play and':'You'} picked up ${count} cards. No burn.`);tell(`${who==='house'?'House picked up '+count+' cards. Your move.':'You picked up '+count+' cards. House plays next.'}`);endMove();}}
function queueAI(){clearTimeout(aiTimer);if(g.ended||g.turn!=='house'||modalKind||moving)return;busy=true;render();aiTimer=setTimeout(()=>{busy=false;if(modalKind||g.ended||g.turn!=='house'||moving)return;let opts=options(g,'house');if(!opts.length){animatePickup('house');return}let skill=config.aiSkill||g.round;opts.sort((a,b)=>b.length-a.length||a[0].r-b[0].r);let choice=skill===1?opts[Math.floor(Math.random()*Math.min(opts.length,3))]:opts[0];if(source(g.house)==='blind')choice=[g.house.blind[Math.floor(Math.random()*g.house.blind.length)]];animatePlay('house',choice.map(c=>c.id));},Math.max(850,config.aiDelay));}
function open(content,kind='info'){if(dragState)finishCardDrag(null,true);if(moving){queuedModal=()=>open(content,kind);return;}modalFocus=document.activeElement;modalKind=kind;clearTimeout(aiTimer);busy=false;$('overlay').innerHTML=`<section class="modal modal-${kind} ${kind==='intro'?'intro brand-intro':''}" role="dialog" aria-modal="true" tabindex="-1">${content}</section>`;$('overlay').querySelector(kind==='intro'?'.modal':'button,input')?.focus()}
function close(){modalKind='';$('overlay').innerHTML='';modalFocus?.focus?.();if(g.turn==='house'&&!g.ended&&started)queueAI();else render()}
function newRun(){tallyActive=false;displayScore=0;clearTimeout(resultTimer);clearTimeout(aiTimer);g=deal(1,config.extraMagic,config.minHand);score=0;elapsed=0;tricks=[];rewardChoices=[];shields=0;logs=[];selected=[];pending=null;started=true;busy=false;startedMove=Date.now();close();log('You take a seat in the back room.');tell('Welcome to the table. Play any card.');music();startOpeningDeal()}
function intro(){
  const saved=safeRead('ll-save',null),canContinue=started||!!(saved?.g&&(!saved.g.ended||['upgrade','result'].includes(saved.pending)));
  open(`<div class="start-screen"><div class="start-kicker">LET’S GET DEAD</div><div class="start-identity">${brandMarkup(artStyle,'title')}</div><p class="start-hook">Lose your cards.<br><strong>Don’t be the Bonehead.</strong></p><div class="start-facts" aria-label="Three rounds, four magic cards, one Bonehead"><span><b>3</b> ROUNDS</span><span><b>4</b> MAGIC CARDS</span><span><b>1</b> BONEHEAD</span></div><div class="start-actions"><button class="start-new" data-action="rules">HOW TO PLAY</button><button class="start-play" data-action="${started?'resume':canContinue?'continue':'start'}">${canContinue?'CONTINUE':'PLAY GAME'} <span aria-hidden="true">↗</span></button></div><div class="start-links"><button data-action="audio">SOUND & MUSIC</button></div><p class="start-footnote">A little luck. A lot of bad intentions.</p></div>`,'intro');
}

function fullRules(){open(`<button class="close" data-action="return" aria-label="Close rules">×</button><div class="eyebrow">KNOW WHEN TO WALK AWAY</div><h2>Leave nothing behind.</h2><div class="rules-row"><strong>01</strong><p>Play equal to or higher than the pile. Can't play? Pick up the pile and lose your turn. You can only pick up when you have no legal play.</p></div><div class="rules-row"><strong>02</strong><p>After playing, draw back to ${config.minHand} cards while the draw pile lasts. Once it is empty, clear your hand, then your three face-up table cards, then your three blind cards.</p></div><div class="rules-row"><strong>03</strong><p>Select cards in order. Link equal ranks or consecutive cards of the same suit (3♥ → 4♥ → 5♥). The first card must be legal; suit links can carry you through a 9. A burn ends the run.</p></div><div class="rules-row"><strong>✦</strong><p><b>2 resets. 8 is transparent. 9 demands 9 or lower on the next non-8 card. 10 burns.</b> 2, 8, 9 and 10 are always legal, whatever is on the pile. Four consecutive cards of one rank burn the pile too. Every burn gives another turn.</p></div><div class="rules-row"><strong>04</strong><p>Blind cards flip one at a time. A bad flip goes into your hand with the pile. Clear that hand before flipping again. First player with no cards wins the round.</p></div><div class="rules-row"><strong>05</strong><p>Win all three rounds to beat the house. Choose a trick between wins. Longer runs multiply points; fast moves earn a small bonus. Card ranks set the base score; magic cards are worth 200–300. Three and four of a kind earn extra multipliers. Burns pay 100 plus 25% of the pile value, boosted at 5, 10, 15 and 20 cards. Optional goals pay immediately: 500 on your second burn and 750 when you win without a pickup. Earn single-use Fresh Bones or Switcheroo cards between rounds; play them on your turn without losing that turn. There is no turn deadline.</p></div><button class="primary" data-action="return">GOT IT <span>↗</span></button>`,'rules')}
const upgrades={reshuffle:{name:'Fresh Bones',description:'One use: exchange your entire hand for random cards from the draw deck. Keeps your turn.'},swap:{name:'Switcheroo',description:'One use: choose a hand card and trade it for a random draw-deck card. Keeps your turn.'},wild:{name:'Loaded Sleeves',description:'Start every remaining round with a bonus 2 and 10 in your hand. Two more ways out.'},chain:{name:'Chain Reaction',description:'Add another ×0.25 per extra card to your combo multiplier. Stacks with three- and four-of-a-kind bonuses.'},insurance:{name:'Second Chance',description:'One failed blind flip per remaining round is discarded. Keep the pile and take another turn.'},embers:{name:'Ash Collector',description:'Every card in a pile you burn is worth an extra 35 points.'}};
function trickButton(id){const u=upgrades[id];return '<button class="upgrade upgrade-'+id+'" data-upgrade="'+id+'"><span class="upgrade-icon" aria-hidden="true"></span><b>'+u.name+'</b><p>'+u.description+'</p><small>CHOOSE THIS TRICK</small></button>'}
function reward(){
  const eligible=Object.keys(upgrades).filter(id=>!tricks.includes(id));
  if(pending!=='upgrade'||rewardChoices.length!==3||rewardChoices.some(id=>!eligible.includes(id))){
    for(let i=eligible.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
    rewardChoices=eligible.slice(0,3);
  }
  pending='upgrade';save();
  open(`<div class="eyebrow">THE HOUSE OWES YOU ONE</div><h2>Claim a trick.</h2><p>Round ${g.round} cleared. Choose one to take to the next table.</p><div class="upgrade-list">${rewardChoices.map(id=>{const u=upgrades[id];return `<button class="upgrade upgrade-${id}" data-upgrade="${id}"><span class="upgrade-icon" aria-hidden="true"></span><small class="upgrade-kind">${['reshuffle','swap'].includes(id)?'ONE USE':'REST OF RUN'}</small><b>${u.name}</b><p>${u.description}</p><span class="upgrade-choose">CLAIM TRICK</span></button>`}).join('')}</div>`,'upgrade');
}
function chooseUpgrade(id){if(!upgrades[id]||tricks.includes(id)||pending!=='upgrade'||!rewardChoices.includes(id))return;const items={...(g.items||{})};if(['reshuffle','swap'].includes(id))items[id]=(items[id]||0)+1;else tricks.push(id);let round=g.round+1;g=deal(round,config.extraMagic,config.minHand);g.items=items;if(tricks.includes('wild'))g.player.hand.push({r:2,s:1,id:`gift-${round}-2`},{r:10,s:0,id:`gift-${round}-10`});shields=tricks.includes('insurance')?1:0;pending=null;rewardChoices=[];selected=[];busy=false;startedMove=Date.now();close();log(`${upgrades[id].name} joins your bag of tricks.`);tell('New table. Same bad intentions.');startOpeningDeal()}
function finish(){
  clearTimeout(aiTimer);clearTimeout(resultTimer);busy=false;
  payGoals();checkTrophies();
  best=Math.max(best,score);persist('ll-best',best);pending='result';save();render();
  resultTimer=setTimeout(showResult,350);
}
function showResult(){
  const win=g.winner==='player',advance=win&&g.round<3,loser=win?['Lucky Bones','The Velvet Reaper','The Pit Boss'][g.round-1]:'YOU';
  sound(win?'win':'pickup');
  const goals=roundGoals(g).filter(x=>x.complete);
  open(`<div class="award-scene ${win?'victory':'defeat'}"><div class="eyebrow">${win?'YOU WIN · THE HOUSE TAKES THE TITLE':'THE HOUSE WINS · YOUR NEW TITLE'}</div><div class="award-skull"><img src="${artStyle==='v1'?'assets/bonehead.png':ART_STYLES[artStyle].mark}" alt="Bonehead skull"><span>OFFICIALLY</span></div><div class="award-name">${loser}</div><h2 class="bonehead-stamp">BONEHEAD</h2><p>${win?(advance?'No cards. No shame. On to the next table.':'Three tables cleared. You beat death at its own game.'):'You kept the cards. And earned the title. Wear it badly.'}</p><div class="result-score">${score.toLocaleString()}<small>RUN POINTS</small></div>${goals.length?`<div class="goal-receipt">${goals.map(x=>`<span>✓ ${x.name} <b>+${x.points}</b></span>`).join('')}</div>`:''}<p class="result-stats">ROUND ${g.round} / 3 · ${g.playerBurns||0} YOUR BURNS · ${formatTime(elapsed)}<br>BEST RUN ${best.toLocaleString()}</p><button class="primary" data-action="${advance?'claim-trick':'start'}">${advance?'CLAIM A TRICK & CONTINUE':'ONE MORE RUN'} <span>↗</span></button></div>`,'result');
}

function menu(){if(!started){intro();return}open(`<button class="close" data-action="close" aria-label="Close menu">×</button><div class="eyebrow">TAKE A BREATHER</div><h2>The cards can wait.</h2><p>Your run is saved on this browser. The clock and the house are paused.</p><button class="primary" data-action="close">BACK TO THE TABLE</button><button class="secondary" data-action="audio" style="margin-top:20px">MUSIC, SOUND & CREDITS</button><button class="secondary" data-action="scoring" style="margin-top:12px">HOW SCORING WORKS</button><button class="secondary" data-action="trick-list" style="margin-top:12px">YOUR TRICK CARDS</button><button class="secondary" data-action="rules" style="margin-top:12px">HOW TO PLAY</button><button class="secondary" data-action="restart" style="margin-top:12px">START A NEW RUN</button>`,'menu')}
function showScoring(){open(`<button class="close" data-action="return" aria-label="Close scoring guide">×</button><div class="eyebrow">MAKE EVERY CARD COUNT</div><h2>How scoring works.</h2><p><b>Card values × combo multiplier + burn + quick bonus.</b></p><div class="rules-row"><strong>01</strong><p>Number cards: rank × 10. J 110 · Q 120 · K 130 · A 150.<br>Magic: 2 = 200 · 8 = 240 · 9 = 260 · 10 = 300.</p></div><div class="rules-row"><strong>02</strong><p>One card ×1. Two cards ×1.5. Three linked cards ×2. Each extra card adds ×0.5.<br>Three of a kind adds another ×0.5 (three sixes: 180 × 2.5 = 450). Four of a kind adds ×1.5 (four kings: 520 × 4 = 2,080). These bonuses do not stack with each other.<br>Chain Reaction adds ×0.25 per extra card. Multipliers reset for each play.</p></div><div class="rules-row"><strong>03</strong><p>Burn: 100 + 25% of the entire pile’s card value, including your burning cards, multiplied by the pile bonus. Five cards ×1.25 · ten ×1.5 · fifteen ×1.75 · twenty or more ×2. Rounded to the nearest point.<br>Ash Collector adds 35 per burned card. The combo multiplier applies only to cards you played, not the burn reward. Picking up scores nothing.</p></div><div class="rules-row"><strong>04</strong><p>Quick plays add up to ${config.timeBonus*5} points. No penalty for taking your time. Bonus goals still pay separately when achieved.</p></div><button class="primary" data-action="return">BACK TO THE TABLE</button>`,'scoring')}
function confirmRestart(){open(`<button class="close" data-action="close" aria-label="Keep playing">×</button><img class="restart-skull" src="assets/bonehead-skull-icon.png" alt=""><div class="eyebrow">A CLEAN SLATE?</div><h2>Deal a new run?</h2><p>Your current run will be replaced.<br>Your best score and trophies stay with you.</p><div class="start-actions"><button class="start-new" data-action="close">KEEP PLAYING</button><button class="start-play" data-action="start">NEW RUN <span aria-hidden="true">↗</span></button></div>`,'confirm')}
function dev(){open(`<button class="close" data-action="return" aria-label="Close tuning panel">×</button><div class="eyebrow">BEHIND THE CURTAIN</div><h2>The house rules.</h2><p>Original V1 table. Hand size and extra cards take effect on a new deal. Settings stay on this browser.</p>${[['minHand','Minimum hand',1,7],['aiDelay','House delay (ms)',200,4000],['timeBonus','Quick-play bonus',0,100],['extraMagic','Extra magic in deck',0,12],['aiSkill','AI: 0 auto · 1 casual · 2 sharp',0,2]].map(([id,name,min,max])=>`<label class="dev-row">${name}<input type="number" data-config="${id}" value="${config[id]}" min="${min}" max="${max}" step="1"></label>`).join('')}<label class="dev-row">Big effects<input type="checkbox" data-config="animations" ${config.animations?'checked':''}></label><div class="dev-actions"><button data-dev="redeal">REDEAL ROUND</button><button data-dev="burn">TEST FOUR-OF-A-KIND</button><button data-dev="blind">JUMP TO BLIND CARDS</button><button data-dev="win">WIN ROUND</button><button data-dev="reset">RESET SETTINGS</button></div>`,'dev')}
$('magicguide').innerHTML=Object.entries(magic).map(([r,m])=>`<div class="magic-item"><div class="magic-icon">${r}</div><div><b>${m[0]}</b><p>${m[1]} · ${cardPoints({r:Number(r)})} PTS</p></div></div>`).join('');
$('hand').addEventListener('click',e=>{if(performance.now()<suppressCardClickUntil){e.preventDefault();return}const el=e.target.closest('[data-card]');if(el)select(el.dataset.card)});$('play').onclick=playerPlay;$('sort').onclick=()=>{if(busy)return;sortSuit=!sortSuit;render()};$('scorehelp').onclick=showScoring;$('lastdetails').onclick=()=>{if(!g.lastHand)return;open(`<button class="close" data-action="return" aria-label="Close last play">×</button><div class="eyebrow">LAST PLAY</div><h2>Your score breakdown.</h2><div class="score-receipt">${$('scoreburst').innerHTML.replace(/ id="[^"]*"/g,'')}</div>`,'last-score')};$('help').onclick=rules;$('menu').onclick=menu;$('newrun').onclick=confirmRestart;$('trophies').onclick=showTrophies;$('sound').onclick=audioSettings;
let brandClicks=0,brandTimer;$('brand').onclick=()=>{clearTimeout(brandTimer);if(++brandClicks>=5){brandClicks=0;dev()}brandTimer=setTimeout(()=>brandClicks=0,1800)};
// Hold the top-right menu (or the title-screen logo) to open the secret panel.
// A regular tap still opens the normal game menu; keyboard access stays Ctrl+Shift+D.
let secretPress=null,secretSuppressUntil=0;
function cancelSecretPress(){if(secretPress)clearTimeout(secretPress.timer);secretPress=null}
document.addEventListener('pointerdown',e=>{
  const target=e.target.closest('#menu,.start-identity');
  if(!target||!e.isPrimary||e.button!==0)return;
  cancelSecretPress();
  secretPress={id:e.pointerId,x:e.clientX,y:e.clientY,timer:setTimeout(()=>{
    secretPress=null;secretSuppressUntil=performance.now()+700;dev();
  },650)};
});
document.addEventListener('pointermove',e=>{if(secretPress?.id===e.pointerId&&Math.hypot(e.clientX-secretPress.x,e.clientY-secretPress.y)>12)cancelSecretPress()});
document.addEventListener('pointerup',cancelSecretPress);
document.addEventListener('pointercancel',cancelSecretPress);
window.addEventListener('blur',cancelSecretPress);
document.addEventListener('contextmenu',e=>{if(e.target.closest('#menu,.start-identity')){e.preventDefault();cancelSecretPress();secretSuppressUntil=performance.now()+700;dev()}});
$('menu').addEventListener('click',e=>{if(performance.now()<secretSuppressUntil||e.shiftKey){e.preventDefault();e.stopImmediatePropagation();if(e.shiftKey)dev()}},true);
$('overlay').addEventListener('click',e=>{
  if(e.target.closest('[data-action="preview-title"]'))intro();
  if(e.target.closest('[data-action="resume"]')){close();if(pending==='upgrade')reward();else if(g.ended)showResult()}
});
$('overlay').addEventListener('click',e=>{const u=e.target.closest('[data-upgrade]');if(u){chooseUpgrade(u.dataset.upgrade);return}const d=e.target.closest('[data-dev]');if(d){let a=d.dataset.dev;clearTimeout(resultTimer);clearTimeout(aiTimer);busy=false;if(a==='reset'){config={...defaults};persist('ll-config',config);dev();return}if(!started){started=true;music()}if(a==='redeal'){g=deal(g.round,config.extraMagic,config.minHand);shields=tricks.includes('insurance')?1:0;pending=null}else if(a==='burn'){g.ended=false;g.turn='player';g.pile=[{r:7,s:0,id:'test7a'},{r:7,s:1,id:'test7b'},{r:7,s:2,id:'test7c'}];g.player.hand=[{r:7,s:3,id:'test7d'},{r:10,s:1,id:'test10'},{r:8,s:0,id:'test8'}]}else if(a==='blind'){g.ended=false;g.turn='player';g.deck=[];g.pile=[];g.player.hand=[];g.player.face=[];if(!g.player.blind.length)g.player.blind=[{r:4,s:1,id:'testblind'}]}else if(a==='win'){g.ended=true;g.winner='player';pending=null;close();finish();return}selected=[];close();tell('Test table ready.');render();return}const swap=e.target.closest('[data-swap]');if(swap){useTrick('swap',swap.dataset.swap);return}let action=e.target.closest('[data-action]')?.dataset.action;if(action==='claim-trick'&&g.ended&&g.winner==='player'&&g.round<3)reward();if(action==='start')newRun();if(action==='begin'){if(safeRead('bh-tutorial-seen',false))newRun();else{tutorialStartsRun=true;walkthrough(0)}}if(action==='tutorial-next')walkthrough(tutorialStep+1);if(action==='tutorial-back')walkthrough(tutorialStep-1);if(action==='tutorial-done')finishTutorial();if(action==='full-rules')fullRules();if(action==='close')close();if(action==='return'){if(started)close();else intro()}if(action==='rules')rules();if(action==='audio')audioSettings();if(action==='trick-list')showTricks();if(action==='scoring')showScoring();if(action==='restart')confirmRestart();if(action==='continue'){let s=safeRead('ll-save',null);if(!s)return;({g,score,tricks,shields,elapsed,logs,pending}=s);rewardChoices=Array.isArray(s.rewardChoices)?s.rewardChoices:[];config={...defaults,...s.config};started=true;selected=[];busy=false;startedMove=Date.now();close();music();render();if(pending==='upgrade')reward();else if(g.ended)finish()}});
$('overlay').addEventListener('input',e=>{if(e.target.id==='musicvolume'){musicVolume=Number(e.target.value)/100;persist('ll-music-volume',musicVolume);$('musicvalue').textContent=e.target.value+'%';music()}});
$('overlay').addEventListener('change',e=>{if(e.target.id==='effectsenabled'){muted=!e.target.checked;persist('ll-muted',muted);sound('select');return}let key=e.target.dataset.config;if(!key)return;config[key]=e.target.type==='checkbox'?e.target.checked:Math.max(Number(e.target.min),Math.min(Number(e.target.max),Math.round(Number(e.target.value)||0)));e.target.value=config[key];persist('ll-config',config);save()});
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyD'){e.preventDefault();dev();return}if(modalKind){if(e.key==='Tab'){let els=[...$('overlay').querySelectorAll('button,input,select')].filter(x=>!x.disabled);let first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}if(e.key==='Escape'&&!['intro','upgrade','result','tutorial'].includes(modalKind)){if(started)close();else intro()}return}if(e.key==='Enter'&&!e.repeat&&!dragState&&(selected.length||mustPickUp())&&!e.target.closest('input,select,textarea,[contenteditable=true]')&&(!e.target.closest('button')||e.target.closest('#hand,#play'))){e.preventDefault();playerPlay();return}if(e.key==='Escape'&&dragState){e.preventDefault();finishCardDrag(null,true);return}if(e.target.matches('input,select,textarea,button'))return;if(e.code==='Space'){e.preventDefault();playerPlay()}if(e.key==='Escape'&&!busy){selected=[];render()}});
function formatTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`}
setInterval(()=>{if(started&&!g.ended&&!modalKind&&!moving&&!document.hidden){elapsed++;$('time').textContent=formatTime(elapsed);if(g.moves<4&&g.turn==='player'&&!busy&&!dragState&&Date.now()-startedMove>6500){if(!mustPickUp()){$('announcement').textContent=selected.length?'Ready — press Enter or PLAY CARDS':guidance(g)+' · Tap or drag a bright card';$('hand').classList.add('needs-nudge');} }else $('hand').classList.remove('needs-nudge');if(elapsed%5===0)save()}},1000);document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!g.ended&&!modalKind)menu()});render();intro();

function rules(){tutorialStartsRun=false;walkthrough(0);}
function walkthrough(step){
  tutorialStep=Math.max(0,Math.min(4,step));
  const sample=(r,s=0)=>card({r,s,id:`lesson-${r}-${s}`});
  const pages=[
    {title:'Lose every last card.',copy:'You and the house take turns. Play equal to or higher than the pile. First one with no cards wins.',art:`<div class="lesson-cards">${sample(4,1)}<span class="lesson-arrow">→</span>${sample(7,0)}<span class="lesson-arrow">→</span>${sample(11,2)}</div>`,note:'Can’t play? Pick up the pile. The house goes next.'},
    {title:`Keep ${config.minHand} in your hand.`,copy:`After you play, the deck automatically deals you back up to ${config.minHand} cards. Once the deck is empty, your hand can finally shrink.`,art:`<div class="lesson-cards refill-demo">${card({id:'lesson-deck'},{back:true})}<span class="lesson-arrow">→</span><div class="lesson-hand">${sample(3,1)}${sample(6,0)}${sample(12,3)}</div></div>`,note:'You can hold more after a pickup. You never discard just to get back to three.'},
    {title:'Four ways to cheat death.',copy:'Every magic card can play on anything. Learn these four and you’re dangerous.',art:`<div class="lesson-magic">${[[2,'RESET','Anything can follow.'],[8,'GHOST','The card beneath still counts.'],[9,'UNDERCUT','Next non-8: 9 or lower.'],[10,'BURN','Burn the pile. Go again.']].map(([r,name,help])=>`<div>${sample(r,r===9?1:0)}<b>${name}</b><p>${help}</p></div>`).join('')}</div>`,note:'Four consecutive cards of the same rank also burn the pile. No other cards burn it.'},
    {title:'Make a run. Make it ring.',copy:'Select equal ranks, or consecutive cards of one suit, in the order you want to play them. The first card must be legal.',art:`<div class="lesson-cards">${sample(3,1)}<span class="lesson-arrow">→</span>${sample(4,1)}<span class="lesson-arrow">→</span>${sample(5,1)}</div><div class="lesson-formula"><b>120</b> × <b>2.0</b> = <strong>240 POINTS</strong></div>`,note:'Cards score by rank: 3 + 4 + 5 = 120 points. Three cards give ×2. Magic cards score 200–300; matching triples give ×2.5. Burns and quick plays add bonuses.'},
    {title:'The last six. No peeking.',copy:'When the deck and your hand are empty, your three face-up cards move across with the three blind cards underneath.',art:`<div class="lesson-cards final-six">${[4,7,12].map((r,i)=>`<div class="lesson-pair">${card({id:`lesson-blind-${i}`},{back:true})}${sample(r,i)}<span>BLIND · LOCKED</span></div>`).join('')}</div>`,note:'Clear ALL face-up cards first. Then flip one blind at a time. A bad flip means picking up the pile and that card.'}
  ];
  const p=pages[tutorialStep];
  open(`<button class="close" data-action="tutorial-done" aria-label="Close walkthrough">×</button><div class="lesson-heading"><img src="assets/bonehead.png" alt=""><div class="eyebrow">BONEHEAD 101 · ${tutorialStep+1} / 5</div></div><h2>${p.title}</h2><p class="lesson-copy">${p.copy}</p>${p.art}<p class="lesson-note">${p.note}</p><div class="lesson-controls"><button class="secondary" data-action="tutorial-back" ${tutorialStep===0?'disabled':''}>BACK</button><div class="lesson-dots">${pages.map((_,i)=>`<i class="${i===tutorialStep?'active':''}"></i>`).join('')}</div><button class="primary" data-action="${tutorialStep===4?'tutorial-done':'tutorial-next'}">${tutorialStep===4?(tutorialStartsRun?'DEAL ME IN':'GOT IT'):'NEXT'} <span>↗</span></button></div><div class="lesson-footer"><button data-action="full-rules">ALL THE RULES</button><button data-action="tutorial-done">${tutorialStartsRun?'SKIP & PLAY':'CLOSE GUIDE'}</button></div>`,'tutorial');
}
function finishTutorial(){persist('bh-tutorial-seen',true);if(tutorialStartsRun){tutorialStartsRun=false;newRun()}else if(started)close();else intro();}
function renderScoreBreakdown(amount=g.lastHand?.points){
  const last=g.lastHand,burst=$('scoreburst');
  burst.parentElement.classList.toggle('has-breakdown',!!last);
  burst.classList.toggle('visible',!!last);
  if(!last){burst.innerHTML='';return;}
  const {base,mult,burnBonus=0,speedBonus=0,burnMult=0}=last;
  burst.innerHTML=`<div class="tally-label">${last.label}</div>${last.cardValues?`<div class="tally-values">${last.cardValues}</div>`:''}${Number.isFinite(base)&&Number.isFinite(mult)?`<div class="tally-equation"><b>${base}</b><span>×</span><strong>${Number(mult.toFixed(2))}</strong></div>`:''}<div class="tally-bonuses">${burnBonus?`<span>BURN +${burnBonus}</span>${last.burnSize?`<span class="tally-fire-detail">${last.burnSize} cards · pile value ${last.pileValue}<br>100 + 25% × ${last.pileValue} × ${Number(burnMult.toFixed(2))}${last.emberBonus?` + ${last.emberBonus} ASH`:''}</span>`:''}`:''}${speedBonus?`<span>QUICK +${speedBonus}</span>`:''}</div><div class="tally-award">+<span id="awardcount">${amount.toLocaleString()}</span></div>`;
}
async function tallyPoints(points,{base,mult,burnBonus,speedBonus,count,burnMult=0}){
  if(!points)return;
  tallyActive=true;displayScore=score-points;const start=displayScore;
  Object.assign(g.lastHand,{base,mult,burnBonus,speedBonus,count,burnMult});
  renderScoreBreakdown(0);$('score').closest('.scorebox').classList.add('counting');
  const tickCount=Math.max(3,Math.min(16,Math.ceil(points/80))),duration=motionOn()?Math.min(1050,250+points*.42):100,begin=performance.now();let lastTick=-1;
  await new Promise(done=>{function step(now){let progress=Math.min(1,(now-begin)/duration),ease=1-Math.pow(1-progress,2),amount=Math.round(points*ease);displayScore=start+amount;$('score').textContent=displayScore.toLocaleString();$('awardcount').textContent=amount.toLocaleString();const tick=Math.floor(progress*tickCount);if(tick!==lastTick&&progress<1){lastTick=tick;const notes=[523,587,659,784,880];tone(notes[tick%5]*Math.pow(2,Math.floor(tick/5)*.12),.07,'triangle',.045);tone(notes[tick%5]*2,.04,'sine',.012);}if(progress<1)requestAnimationFrame(step);else done()}requestAnimationFrame(step)});
  tone(1046,points<120?.12:.22,'sine',.045);tone(1568,points<120?.16:.28,'triangle',.022,.04);tallyActive=false;displayScore=score;await sleep(motionOn()?(points<120?90:300):40);$('score').closest('.scorebox').classList.remove('counting');
}
function crackle(){if(muted)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();const length=audioCtx.sampleRate*1.4,buffer=audioCtx.createBuffer(1,length,audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++){let t=i/length;data[i]=(Math.random()*2-1)*Math.sin(Math.PI*t)*(.2+(Math.random()>.997?.8:0))}const n=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();n.buffer=buffer;filter.type='lowpass';filter.frequency.value=2300;gain.gain.value=.12;n.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);n.start();}catch{}}
async function firePile(){
  if(!motionOn()){sound('burn');$('pile').classList.add('reduced-burn');await sleep(350);$('pile').classList.remove('reduced-burn');return}
  const pile=$('pile'),canvas=document.createElement('canvas');canvas.width=180;canvas.height=270;canvas.className='fire-canvas';canvas.setAttribute('aria-hidden','true');pile.appendChild(canvas);const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();sound('burn');await sleep(350);return}
  const layers=[...pile.querySelectorAll('.stack-card')],particles=[],ash=[];const start=performance.now();let last=start;crackle();tone(65,.8,'sawtooth',.025);
  await new Promise(done=>{function frame(now){const t=(now-start)/1600,dt=Math.min(2,(now-last)/16.67);last=now;ctx.clearRect(0,0,180,270);const progress=Math.max(0,Math.min(1,(t-.08)/.68)),front=230-progress*165;
    for(const el of layers){el.style.clipPath=`inset(0 0 ${progress*100}% 0)`;el.style.filter=`sepia(${progress}) brightness(${1-progress*.65})`;}
    if(t<.79){const intensity=Math.min(1,t*5),span=Math.min(110,18+t*270);for(let i=0;i<Math.ceil(10*intensity);i++)particles.push({x:35+Math.random()*span,y:front+Math.random()*7,vx:(Math.random()-.5)*1.2,vy:-1.7-Math.random()*4.2,life:1,size:3+Math.random()*10});}
    ctx.globalCompositeOperation='lighter';for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=.03*dt;p.size*=.98;if(p.life<=0){particles.splice(i,1);continue}ctx.globalAlpha=p.life;ctx.fillStyle=p.life>.75?'#fff5b0':p.life>.45?'#ffb62c':p.life>.2?'#ff581e':'#bf2338';ctx.fillRect(Math.round(p.x/2)*2,Math.round(p.y/2)*2,Math.ceil(p.size/2)*2,Math.ceil(p.size*1.8/2)*2);}
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    if(t>.54&&t<.85)for(let i=0;i<4;i++)ash.push({x:35+Math.random()*110,y:front+Math.random()*18,vx:.4+Math.random(),vy:Math.random()*1.5,life:1,size:1+Math.random()*3});
    for(let i=ash.length-1;i>=0;i--){const p=ash[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=.019*dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=i%2?'#c0b6c5':'#514952';ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size)}ctx.globalAlpha=1;
    if(t<1)requestAnimationFrame(frame);else done();}requestAnimationFrame(frame)});
  canvas.remove();
}

// Pointer gestures supplement click-to-select and the Play button.
$('hand').addEventListener('pointerdown',e=>{
  const cardEl=e.target.closest('[data-card]');
  if(!cardEl||e.button!==0||!e.isPrimary||dragState||!started||busy||moving||g.ended||modalKind||g.turn!=='player')return;
  const id=cardEl.dataset.card,ids=selected.includes(id)?[...selected]:[id];
  dragState={pointer:e.pointerId,id,ids,el:cardEl,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,startRect:cardEl.getBoundingClientRect(),samples:[{x:e.clientX,y:e.clientY,t:performance.now()}],dragging:false,ghost:null,hidden:[]};
  // Capture on the card immediately: fast touch flicks can leave the hand
  // before the next move event. Keeping the card target preserves tap-select.
  try{cardEl.setPointerCapture(e.pointerId)}catch{}
});
document.addEventListener('pointermove',e=>{
  const d=dragState;if(!d||d.pointer!==e.pointerId)return;
  d.x=e.clientX;d.y=e.clientY;const dx=d.x-d.startX,dy=d.y-d.startY;
  if(!d.dragging&&Math.hypot(dx,dy)<8)return;
  if(!d.dragging){
    d.dragging=true;suppressCardClickUntil=performance.now()+500;
    d.ghost=d.el.cloneNode(true);d.ghost.removeAttribute('data-card');d.ghost.removeAttribute('data-ref');d.ghost.setAttribute('aria-hidden','true');d.ghost.tabIndex=-1;d.ghost.classList.remove('selected','unplayable');d.ghost.classList.add('drag-card');
    d.ghost.style.cssText=`position:fixed;left:${d.startRect.left}px;top:${d.startRect.top}px;width:${d.startRect.width}px;height:${d.startRect.height}px;min-width:0;margin:0;z-index:70;pointer-events:none;animation:none;transform-origin:center;`;
    if(d.ids.length>1){const badge=document.createElement('b');badge.className='drag-count';badge.textContent=d.ids.length+' CARDS';d.ghost.appendChild(badge)}document.body.appendChild(d.ghost);
    d.hidden=d.ids.map(id=>$('hand').querySelector(`[data-card="${id}"]`)).filter(Boolean);d.hidden.forEach(el=>el.style.visibility='hidden');sound('select');
  }
  e.preventDefault();d.samples.push({x:d.x,y:d.y,t:performance.now()});d.samples=d.samples.filter(p=>performance.now()-p.t<130);
  d.ghost.style.transform=`translate(${dx}px,${dy}px) rotate(${Math.max(-12,Math.min(12,dx*.045))}deg) scale(1.035)`;
  const pile=rect($('pile'));const over=cardOverPile(d,rect(d.ghost),pile);
  const src=source(g.player),cards=d.ids.map(id=>g.player[src].find(c=>c.id===id));const can=src==='blind'||valid(cards,g.pile);
  $('pile').classList.toggle('drag-ready',can);$('pile').classList.toggle('drag-over',can&&over);$('pile').classList.toggle('drag-invalid',!can&&over);
},{passive:false});
function finishCardDrag(e,cancel=false){
  const d=dragState;if(!d||e&&d.pointer!==e.pointerId)return;dragState=null;
  try{if(d.el.hasPointerCapture(d.pointer))d.el.releasePointerCapture(d.pointer)}catch{}
  $('pile').classList.remove('drag-ready','drag-over','drag-invalid');
  if(!d.dragging)return;
  suppressCardClickUntil=performance.now()+400;
  const x=e?.clientX??d.x,y=e?.clientY??d.y,pile=rect($('pile')),first=d.samples[0],last=d.samples.at(-1),elapsed=Math.max(1,performance.now()-first.t),vx=(x-first.x)/elapsed,vy=(y-first.y)/elapsed;
  const speed=Math.hypot(vx,vy),distance=Math.hypot(x-d.startX,y-d.startY),toX=pile.left+pile.width/2-x,toY=pile.top+pile.height/2-y,alignment=(vx*toX+vy*toY)/(speed*Math.hypot(toX,toY)||1);
  const drop=cardOverPile({x,y},rect(d.ghost),pile);
  const flick=speed>.65&&distance>45&&alignment>.78&&y<d.startY-25&&performance.now()-last.t<110;
  const src=source(g.player),cards=d.ids.map(id=>g.player[src].find(c=>c.id===id)),legalMove=cards.every(Boolean)&&(src==='blind'?cards.length===1:valid(cards,g.pile));
  if(!cancel&&(drop||flick)&&legalMove&&!busy&&!moving&&!g.ended&&g.turn==='player'&&!modalKind){
    const release=d.ghost.getBoundingClientRect();d.ghost.remove();d.hidden.forEach(el=>el.style.visibility='');selected=d.ids;
    d.ids.forEach((id,i)=>flickOrigins.set(id,{left:release.left+i*3,top:release.top+i*3,width:release.width,height:release.height}));
    if(flick)tone(740,.08,'sine',.025);playerPlay();return;
  }
  if(!cancel&&(drop||flick)&&!legalMove){tell('That play cannot beat the pile. Try a brighter card or a magic card.',true);sound('bad');}
  const ghost=d.ghost,restore=()=>{ghost.remove();d.hidden.forEach(el=>el.style.visibility='')};
  if(motionOn()&&ghost.animate){ghost.animate([{transform:ghost.style.transform},{transform:'translate(0,0) rotate(0deg) scale(1)'}],{duration:220,easing:'cubic-bezier(.2,.8,.25,1)',fill:'forwards'}).finished.then(restore,restore)}else restore();
}
$('hand').addEventListener('pointerup',e=>finishCardDrag(e));
$('hand').addEventListener('pointercancel',e=>finishCardDrag(e,true));
$('hand').addEventListener('lostpointercapture',e=>{if(dragState?.pointer===e.pointerId)finishCardDrag(e,true)});
$('hand').addEventListener('dragstart',e=>e.preventDefault());

document.addEventListener('pointerup',e=>{if(dragState?.pointer===e.pointerId)finishCardDrag(e)});
document.addEventListener('pointercancel',e=>{if(dragState?.pointer===e.pointerId)finishCardDrag(e,true)});
window.addEventListener('blur',()=>finishCardDrag(null,true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)finishCardDrag(null,true)});

// Track the actual responsive play-card size, including short viewports.
const pileSizeObserver=new ResizeObserver(entries=>{
  const {width,height}=entries[0].contentRect;
  $('drawstack').style.width=`${width*.8}px`;
  $('drawstack').style.height=`${height*.8}px`;
  $('drawstack').parentElement.style.width=`${width*.8}px`;
  $('pile').closest('.playzone').style.setProperty('--actual-pile-h',`${height}px`);
});
pileSizeObserver.observe($('pile'));

const unlocked=safeRead('bh-trophies',{}),toastQueue=[];let toastShowing=false;
function queueTrophy(title,detail){toastQueue.push({title,detail});showNextTrophy()}
function showNextTrophy(){if(toastShowing||!toastQueue.length)return;toastShowing=true;const t=toastQueue.shift(),el=$('trophytoast');el.innerHTML=`<span>🏆</span><div><small>${t.detail}</small><b>${t.title}</b></div>`;el.classList.add('visible');tone(660,.18,'sine',.03);tone(990,.25,'sine',.03,.13);setTimeout(()=>{el.classList.remove('visible');setTimeout(()=>{toastShowing=false;showNextTrophy()},300)},3400)}
function checkTrophies(result){for(const id of earnedTrophies(g,result)){if(unlocked[id])continue;unlocked[id]=new Date().toISOString();persist('bh-trophies',unlocked);queueTrophy(trophies[id].name,trophies[id].rarity+' TROPHY UNLOCKED')}}
function showTrophies(){open(`<button class="close" data-action="return" aria-label="Close trophies">×</button><div class="eyebrow">YOUR AFTERLIFE ACHIEVEMENTS</div><h2>Trophy cabinet.</h2><p>${Object.keys(unlocked).length} / ${Object.keys(trophies).length} unlocked · saved on this browser across runs.</p><div class="trophy-list">${Object.entries(trophies).map(([id,t])=>`<div class="trophy-entry ${unlocked[id]?'unlocked':''}"><span>${unlocked[id]?'🏆':'◇'}</span><div><small>${t.rarity}${unlocked[id]?' · UNLOCKED':''}</small><b>${t.name}</b><p>${t.detail}</p></div></div>`).join('')}</div>`,'trophies')}
function payGoals(){const earned=claimGoals(g);for(const goal of earned){score+=goal.points;showEffect('goal','GOAL COMPLETE',goal.name+' · +'+goal.points);queueTrophy(goal.name,'BONUS GOAL · +'+goal.points+' POINTS')}return earned}
function renderTricks(){
  const items=g.items||{},count=Object.values(items).reduce((a,b)=>a+b,0);
  $('trickcount').textContent=count+' UNUSED';
  const consumables=Object.entries(items).filter(([id,n])=>n>0&&upgrades[id]).map(([id,n])=>{
    const unavailable=!started||g.turn!=='player'||busy||moving||g.ended||!g.player.hand.length||g.deck.length<(id==='reshuffle'?g.player.hand.length:1);
    return `<button class="trick-card upgrade-${id}" data-trick="${id}" title="${upgrades[id].description}" aria-label="${upgrades[id].name}, ${n} unused. ${upgrades[id].description}" ${unavailable?'disabled':''}><span class="upgrade-icon" aria-hidden="true"></span><em class="trick-quantity">×${n}</em><b>${upgrades[id].name}</b><p>${upgrades[id].description}</p><small>${unavailable?'SAVED FOR LATER':'PLAY TRICK'}</small></button>`;
  }).join('');
  const passive=tricks.map(id=>`<div class="owned-trick upgrade-${id}" title="${upgrades[id].description}"><span class="upgrade-icon" aria-hidden="true"></span><b>${upgrades[id].name}</b><p>${upgrades[id].description}</p><small>PASSIVE${id==='insurance'?' · '+shields+' LEFT':''}</small></div>`).join('');
  $('tricks').innerHTML=consumables+passive||'<div class="empty-trick"><span>Win a round to earn trick cards or lasting perks.</span></div>';
}

document.addEventListener('click',e=>{if(e.target.closest('[data-trick-details]')){showTricks();return}const id=e.target.closest('[data-trick]')?.dataset.trick;if(!id||busy||moving||g.turn!=='player')return;if(id==='swap'){open(`<button class="close" data-action="close" aria-label="Cancel swap">×</button><div class="eyebrow">SWITCHEROO</div><h2>Trade one card.</h2><p>Choose any card from your hand. You’ll receive a random deck card and keep your turn.</p><div class="swap-choices">${g.player.hand.map(c=>`<button data-swap="${c.id}">${label(c.r)}${SUITS[c.s]}</button>`).join('')}</div>`,'swap')}else useTrick(id)});
async function useTrick(id,cardId){if(busy||moving||g.turn!=='player')return;const next=structuredClone(g),result=exchangeHand(next,id,cardId);if(!result)return;if(modalKind)close();lockMove('PLAYING '+upgrades[id].name.toUpperCase());try{for(const c of result.old){const el=origin('player',c,'hand');if(el)el.style.visibility='hidden';dealFlick();await flyCard(c,rect(el),rect($('drawstack')),{back:true,duration:160})}g=next;render();for(const c of result.fresh){const el=origin('player',c,'hand');if(el)el.style.visibility='hidden';dealFlick();await flyCard(c,rect($('drawstack')),rect(el),{duration:180});if(el)el.style.visibility=''}}finally{g=next;selected=[];showEffect('reset',upgrades[id].name.toUpperCase(),'NEW CARDS · YOUR TURN');tell('Trick played. Your turn continues.');endMove()}}

function showTricks(){renderTricks();open(`<button class="close" data-action="close" aria-label="Close tricks">×</button><div class="eyebrow">A LITTLE HELP FROM THE AFTERLIFE</div><h2>Your trick cards.</h2><p>Use a card on your turn. It keeps your turn and is consumed once played. Fresh Bones needs enough cards left in the deck to replace your hand.</p><div class="trick-inventory">${$('tricks').innerHTML}</div>`,'tricks')}
