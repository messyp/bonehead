import { P } from '../js/art/palette.js';
import { OPPONENTS, portrait, oppIndex } from '../js/art/sprites.js';
import { ROUNDS, RULES, ROOMS, HOUSE_RULES } from '../js/game/rounds.js';
import { codeHTML } from './devlib.js';

const root = document.getElementById('cast');
const roman = ['I', 'II'];
const live = [];

for (const room of ROOMS) {
  const sec = document.createElement('section');
  sec.innerHTML = `<div class="eyebrow">Room ${roman[room.n - 1]}</div><h2>${room.name.charAt(0) + room.name.slice(1).toLowerCase()}</h2><div class="grid"></div>`;
  const grid = sec.querySelector('.grid');
  ROUNDS.forEach((rd, i) => {
    if ((rd.room || 1) !== room.n) return;
    for (const id of rd.opps) {
      const idx = oppIndex(id), o = OPPONENTS[idx], rule = rd.rule ? RULES[rd.rule] : null;
      const lines = rule ? (typeof rule.lines === 'function' ? rule.lines({ houseRules: Object.keys(HOUSE_RULES) }) : rule.lines) : ['Classic rules. Lose every card first.'];
      const art = document.createElement('article');
      art.className = 'opp';
      art.style.setProperty('--accent', o.color);
      art.innerHTML = `
        <div class="por"><canvas width="44" height="44" class="px"></canvas></div>
        <div class="info">
          <div class="eyebrow">Table ${i + 1}${rd.opps.length > 1 ? ' · with ' + rd.opps.filter(x => x !== id).map(x => OPPONENTS[oppIndex(x)].name).join(', ') : ''}</div>
          <h3>${o.name}${o.short ? ` <span class="short">${o.short}</span>` : ''}</h3>
          <p class="venue">${o.venue} · <em>${o.stake}</em></p>
          ${rule ? `<p><span class="pill rule">${rule.title}</span></p>` : ''}
          <p class="rules">${lines.map(codeHTML).join('<br>')}</p>
          <ul class="said">${['intro', 'playerPickup', 'houseWin', 'playerWin'].map(k => `<li><span>${({ intro: 'Hello', playerPickup: 'You pick up', houseWin: 'Wins', playerWin: 'Loses' })[k]}</span>“${(o.lines[k] || [''])[0]}”</li>`).join('')}</ul>
        </div>`;
      grid.appendChild(art);
      live.push({ idx, cv: art.querySelector('canvas'), off: Math.random() * 3 });
    }
  });
  root.appendChild(sec);
}

// Portraits idle, blink and talk like they do at the table
function draw(t) {
  for (const p of live) {
    const k = (t / 1000 + p.off) % 4, state = k < 0.15 ? 'blink' : k > 2.6 && k < 3.4 && Math.floor(t / 140) % 2 ? 'talk' : 'idle';
    const spr = portrait(p.idx, state, Math.floor(t / 160));
    const x = p.cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 44, 44); x.drawImage(spr.c, 0, 0);
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
void P;
