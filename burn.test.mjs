import assert from 'node:assert/strict';
import {burned} from './dist/engine.js';
const c=(r,s=0)=>({r,s,id:`${r}-${s}`});
for(let rank=2;rank<=14;rank++){
 assert.equal(burned([c(rank)]),rank===10,`single ${rank}`);
 if(rank!==10){assert.equal(burned([c(rank),c(rank,1),c(rank,2)]),false,`only three ${rank}`);assert.equal(burned([c(rank),c(rank,1),c(rank,2),c(rank,3)]),true,`four consecutive ${rank}`);}
}
assert.equal(burned([c(7),c(7),c(8),c(7),c(7)]),false,'transparent 8 still interrupts four-of-a-kind');
assert.equal(burned([c(7),c(7),c(7),c(9)]),false,'a different fourth card does not burn');
assert.equal(burned([]),false);
console.log('Burn causes verified: only 10 or four consecutive equal ranks.');
