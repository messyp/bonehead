export const ART_STYLES=Object.freeze({v1:{name:'Original',note:'Pixel magic · midnight blues',mark:'assets/bonehead-skull-icon.png',color:'#151b40'}});
export function normalizeArtStyle(){return 'v1'}
export function readArtStyle(){return 'v1'}
export function storeArtStyle(){return 'v1'}
export function brandMarkup(value,placement='header'){
  if(placement==='header')return '<span class="header-wordmark-text"><img src="assets/bonehead-skull-reward.png" alt="" aria-hidden="true">BONEHEAD</span>';
  return '<h1 class="supplied-logo"><img src="assets/bonehead-rubberhose.png" alt="Bonehead" width="1254" height="1254"></h1>';
}
