/* Harbour scenery and interactive props in the shared 1280 × 720 stage. */
'use strict';
(() => {
 const blue = '#95dee7';
 const brass = '#f4bc76';
 const text = (x,y,label,size=16,color='#d9e7ec') =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui" font-size="${size}" letter-spacing="1" fill="${color}">${label}</text>`;
 const box = (x,y,w,h,fill='#172732') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fill}" stroke="#50646f" stroke-width="4"/>`;
 const lamp = (x,y) => `<circle cx="${x}" cy="${y}" r="85" fill="url(#beacon-glow)"/>
  <path d="M${x-23} ${y-6}h46l-11-12h-24Z" fill="#84674e"/>
  <rect x="${x-15}" y="${y-6}" width="30" height="8" rx="3" fill="${brass}"/>`;
 DeliveryArt.defs += `
  <linearGradient id="beacon-sky" x2="0%" y2="100%"><stop stop-color="#08121e"/><stop offset="1" stop-color="#385468"/></linearGradient>
  <linearGradient id="beacon-sea" x2="0%" y2="100%"><stop stop-color="#244453"/><stop offset="1" stop-color="#081623"/></linearGradient>
  <radialGradient id="beacon-glow"><stop stop-color="#ffcd83" stop-opacity=".45"/><stop offset="1" stop-color="#ffcd83" stop-opacity="0"/></radialGradient>
  <linearGradient id="beacon-ray"><stop stop-color="#fff0b9" stop-opacity=".85"/><stop offset="1" stop-color="#aeefff" stop-opacity=".15"/></linearGradient>`;
 function ocean(){
  const ripples = Array.from({length:24},(_,i)=>{
   const x=(i*173)%1240, y=434+(i*37)%200;
   return `<path d="M${x} ${y}q28-7 66 0t64 0" fill="none" stroke="#85b7c5" stroke-opacity=".2" stroke-width="2"/>`;
  }).join('');
  return `<rect width="1280" height="720" fill="url(#beacon-sky)"/>
   <circle cx="991" cy="172" r="42" fill="#a1bec5" opacity=".38"/>
   <path d="M0 412L102 378l130 13 99-79 157 86 153 14 183-47 102 19 149-56 205 72v55H0Z" fill="#13242e"/>
   <path d="M0 420H1280V720H0Z" fill="url(#beacon-sea)"/>${ripples}`;
 }
 function floor(y=510){
  return `<path d="M0 ${y}H1280V720H0Z" fill="#25303a"/>
   <path d="M0 553H1280M0 604H1280M0 661H1280M250 ${y} 180 720M510 ${y} 470 720M770 ${y} 800 720M1020 ${y} 1150 720" stroke="#111e2a" stroke-width="4"/>`;
 }
 DeliveryArt.home = () => ocean()+
  `<path d="M0 498H1280M46 433v126M197 433v126M1005 433v126M1224 433v126" stroke="#384249" stroke-width="13"/>
   <path d="M1045 507l15-218h137l40 218Z" fill="#21333c" stroke="#0e1923" stroke-width="7"/>
   <path d="M1048 290h160l-79-54Z" fill="#0e1923"/>
   ${box(1094,354,92,158,'#111e28')}${lamp(1140,340)}`+floor();
 DeliveryArt.stall = () =>
  `<rect width="1280" height="720" fill="url(#beacon-sky)"/>
   <path d="M0 212H1280M0 268H1280M0 325H1280M0 382H1280M0 439H1280" stroke="#52616b" opacity=".32" stroke-width="3"/>
   ${box(491,199,245,245,'#0d202b')}
   <path d="M615 201v239m-120-120h238M507 349l205-98m-205 144 205-98" stroke="#587585" opacity=".55" stroke-width="4"/>
   ${floor()}${box(250,446,248,34,'#695146')}
   <path d="M267 478v55m205-55v55" stroke="#5c4e46" stroke-width="13"/>${lamp(386,311)}${lamp(933,233)}`;
 DeliveryArt.platform = () => ocean()+
  `<path d="M0 146H1280M0 528H1280M206 146v382M500 146v382M816 146v382M1164 146v382" fill="none" stroke="#263a44" stroke-width="16"/>
   <path d="M207 146 500 528m316 0 348-382" stroke="#435d67" opacity=".5" stroke-width="5"/>${floor(528)}`;
 const lens = `<circle cx="45" cy="45" r="34" fill="#275a68" stroke="#abdce4" stroke-width="6"/>
  <circle cx="45" cy="45" r="23" fill="none" stroke="#8bcedb" stroke-width="3"/>
  <path d="M23 51 52 21m-12 49 28-29" stroke="#d8f7fa" stroke-width="3" opacity=".7"/>`;
 DeliveryArt.icons.lens = lens;
 const exits = {cross:'WORKSHOP →',back:'← HARBOUR PIER',platform:'LANTERN ROOM →',cabin:'← WORKSHOP'};
 DeliveryArt.prop = ({id,x,y,w,h},state) => {
  if(exits[id])return box(x,y+h-46,w,44)+text(x+w/2,y+h-18,exits[id],13);
  if(id==='notice')return box(x,y,w,h)+text(x+w/2,y+29,'CHANNEL CHART',16,brass)+
   ['INNER HARBOUR','DEEP CHANNEL','SHOALS'].map((name,i)=>
    text(x+86,y+60+i*35,name,13)+text(x+176,y+60+i*35,['▬','● ●','● ● ●'][i],15,blue)).join('');
  if(id==='lens')return `<svg x="${x+12}" y="${y+7}" width="78" height="70" viewBox="0 0 90 90">${lens}</svg>`;
  if(id==='panel')return `<path d="M660 337v136m-59 2h119" stroke="#647883" stroke-width="13"/>
   <circle cx="660" cy="294" r="70" fill="#0d1c28" stroke="#718893" stroke-width="10"/>
   ${state.flags.lensFitted?`<svg x="596" y="230" width="128" height="128" viewBox="0 0 90 90">${lens}</svg>`:''}
   ${text(660,407,state.flags.lensFitted?'LENS FITTED':'EMPTY MOUNT',14)}`;
  if(id==='lever')return box(x,y,w,h)+text(x+w/2,y+35,'SIGNAL DIAL',15)+
   `<circle cx="${x+w/2}" cy="${y+88}" r="28" fill="#0e202c" stroke="#6d8d98" stroke-width="4"/>
    <path d="M${x+w/2} ${y+88}l13-17" stroke="${state.flags.signalSet?blue:brass}" stroke-width="5"/>`;
  return '';
 };
 DeliveryArt.ambient = scene => scene==='stall'?'':`<g class="harbour-fog" fill="none" stroke="#b3d1d8" opacity=".13">
  <path d="M-90 397q210-53 476 0t525 0t520-8" stroke-width="24"/>
  <path d="M-95 449q247 44 497 0t499 0t522 0" stroke-width="14"/>
 </g>`;
 window.StormBeaconArt = {rescue:`<path class="beacon-flash" d="M659 293 1280 184V395Z" fill="url(#beacon-ray)"/>
  <g class="rescue-ferry" transform="translate(717 412)">
   <path d="M0 78h313l-43 34H44Z" fill="#142837" stroke="#658897" stroke-width="4"/>
   <path d="M32 74V45h228l31 29Z" fill="#526a73"/><path d="M127 45V16h93l26 29Z" fill="#718894"/>
   <path d="M171 17V-14" stroke="#879ca4" stroke-width="4"/>
   ${Array.from({length:8},(_,i)=>`<rect x="${47+i*27}" y="53" width="16" height="10" rx="2" fill="${brass}"/>`).join('')}
   <path d="M21 127h113m36 0h124" stroke="#efc790" stroke-width="4" opacity=".45"/>
  </g>`};
})();
