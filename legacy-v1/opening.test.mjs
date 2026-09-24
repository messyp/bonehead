import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('dist/app.js','utf8');
const opening=source.slice(source.indexOf('async function startOpeningDeal(){'),source.indexOf('\nfunction origin('));
for(const reduced of [false,true]){
  const events=[],nodes=new Map();let tick=0;
  const node=id=>({id,style:{},classList:{add(){}},querySelector(){return null},closest(){return id.startsWith('house-table')?{}:null},remove(){this.removed=true}});
  const items=Array.from({length:18},(_,i)=>({c:{id:i},el:node((i<12&&i%2===0?'house-table':'item')+i),back:i%2===0}));
  const ctx={g:{deck:Array(34)},moving:false,busy:false,moveLabel:'',dealRun:0,playerCardSize:{width:100,height:140},
    $:id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)},render(){},openingDealItems:()=>items,
    rect:()=>({left:0,top:0,width:600,height:180}),renderDraw:n=>events.push({type:'deck',n}),
    dealFlick:i=>events.push({type:'sound',i,tick}),card:()=>'',motionOn:()=>!reduced,
    document:{createElement:()=>({firstElementChild:node('stage')}),body:{appendChild(){}}},
    async sleep(ms){tick+=ms},async flyCard(c,from,to,options){assert.ok(ctx.moving&&ctx.busy);events.push({type:'flight',id:c.id,...options})},
    async introduceOpponent(){assert.ok(ctx.moving&&ctx.busy);events.push({type:'opponent'})},tell(){},endMove(){ctx.moving=false;ctx.busy=false;events.push({type:'unlock'})},console};
  vm.createContext(ctx);vm.runInContext(opening,ctx);await ctx.startOpeningDeal();
  assert.equal(events.filter(x=>x.type==='opponent').length,1);assert.ok(events.findIndex(x=>x.type==='opponent')<events.findIndex(x=>x.type==='unlock'));if(!reduced)assert.ok(events.findIndex(x=>x.type==='opponent')<events.findIndex(x=>x.type==='sound'));assert.equal(ctx.moving,false);assert.equal(ctx.busy,false);assert.ok(items.every(x=>x.el.style.visibility===''));
  const sounds=events.filter(x=>x.type==='sound');assert.equal(sounds.length,reduced?0:18);
  if(!reduced){assert.deepEqual(sounds.map(x=>x.i),Array.from({length:18},(_,i)=>i));for(let i=1;i<sounds.length;i++)assert.ok(sounds[i].tick-sounds[i-1].tick>=65);assert.equal(events.filter(x=>x.type==='flight').length,30);assert.equal(events.filter(x=>x.type==='deck').at(-1).n,34);}
  assert.equal(events.at(-1).type,'unlock');
}
console.log('Opening checks passed: ordered launches, reserves before hands, input lock and reduced-motion completion.');
