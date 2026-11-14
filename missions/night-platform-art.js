/* Station scenery and props on the shared 1280 × 720 SVG stage. */
'use strict';
(() => {
 const ink = '#090f1b';
 const gold = '#ffc77a';
 const blue = '#82d8ff';
 const text = (x,y,label,size=17,fill='#b5c9d5') =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${size}" letter-spacing="1.2" fill="${fill}">${label}</text>`;
 const frame = (x,y,w,h,fill='#142436',stroke='#344b62') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
 const light = (x,y,color) => `<circle cx="${x}" cy="${y}" r="72" fill="url(#night-glow)" color="${color}"/><circle cx="${x}" cy="${y}" r="8" fill="${color}"/>`;
 const wall = () => `<rect width="1280" height="720" fill="url(#night-wall)"/>
  <path d="M0 202H1280M0 211H1280M0 498H1280" stroke="#435064" opacity=".6" stroke-width="3"/>
  <path d="M0 515H1280V720H0Z" fill="url(#night-floor)"/>
  <path d="M0 555H1280M0 612H1280M0 682H1280M240 515L90 720M480 515L420 720M720 515L755 720M960 515L1090 720" stroke="#475266" opacity=".42" stroke-width="2"/>`;
 const lamp = (x,y) => `<path d="M${x} 0V${y-8}" stroke="#9b7e65" stroke-width="3"/>
  <path d="M${x-36} ${y}h72l-10-14h-52Z" fill="#927455"/>${light(x,y+5,gold)}`;
 const doorway = (x,y,w,h,label) => frame(x,y,w,h,'#101827','#495267') + text(x+w/2,y+35,label,14);
 const rain = () => `<g class="station-rain">${Array.from({length:85},(_,i)=>{
  const x=(i*139)%1330, y=(i*83)%720;
  return `<path d="M${x} ${y}l-13 37" fill="none" stroke="#b6d9f2" stroke-opacity="${.12+(i%4)*.035}" stroke-width="1.5"/>`;
 }).join('')}</g>`;
 DeliveryArt.defs += `
  <linearGradient id="night-wall" x2="0" y2="1"><stop stop-color="#080f21"/><stop offset="1" stop-color="#293852"/></linearGradient>
  <linearGradient id="night-floor" x2="0" y2="1"><stop stop-color="#293744"/><stop offset="1" stop-color="#080e1c"/></linearGradient>
  <radialGradient id="night-glow"><stop stop-color="currentColor" stop-opacity=".44"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>`;
 DeliveryArt.home = () => wall() + `
  <path d="M58 484V280a67 67 0 0 1 134 0v204Z" fill="#0d171f" stroke="#4c6175" stroke-width="6"/>
  <path d="M67 392l112-88m-112 124 112-88M125 216v267" stroke="#46677d" stroke-width="3" opacity=".65"/>
  ${frame(486,256,280,188,'#171d2e')}${text(626,298,'TICKETS',21,gold)}
  <path d="M498 374H754M485 444H769" stroke="#775a49" stroke-width="11"/>
  ${doorway(1070,245,188,300,'SIGNAL CABIN')}
  ${lamp(335,162)}${lamp(950,162)}`;
 DeliveryArt.stall = () => wall() + `
  ${doorway(25,247,175,295,'BOOKING HALL')}${doorway(1070,247,188,295,'RAIN PLATFORM')}
  <path d="M312 468H497V495H312Z" fill="#6e4c3a"/><path d="M330 494V547M476 494V547" stroke="#674d3f" stroke-width="14"/>
  <path d="M642 233V170H943M708 432V499H960" fill="none" stroke="#77808b" stroke-width="5"/>
  ${lamp(381,189)}${lamp(720,130)}`;
 DeliveryArt.platform = () => `
  <rect width="1280" height="720" fill="url(#night-wall)"/>
  <circle cx="993" cy="188" r="49" fill="#798fa6" opacity=".35"/>
  <path d="M0 410L119 313 240 364 330 290 528 364 696 304 830 358 977 281 1280 385V543H0Z" fill="#101a2c"/>
  <path d="M0 420H1280V553H0Z" fill="#141b27"/>
  <path d="M0 458H1280M0 508H1280" stroke="#63738c" stroke-width="4"/>
  <path d="M0 548H1280V720H0Z" fill="url(#night-floor)"/>
  <path d="M0 558H1280" stroke="#ba8a56" stroke-width="5" stroke-dasharray="24 9"/>
  <path d="M0 114H1280L1163 178H0Z" fill="#101426" stroke="#334764" stroke-width="4"/>
  <path d="M205 178V544M950 178V544" stroke="#425568" stroke-width="13"/>
  ${doorway(25,247,175,295,'SIGNAL CABIN')}${lamp(492,193)}${lamp(1107,193)}
  ${frame(525,225,219,53)}${text(634,259,'PLATFORM 01',18,gold)}
  <path d="M245 670q144-19 282-5m420-37q105-22 221-9" stroke="#5a7f9a" opacity=".56" stroke-width="3" fill="none"/>`;
 const exits = {cross:'SIGNAL CABIN →',back:'← BOOKING HALL',platform:'RAIN PLATFORM →',cabin:'← SIGNAL CABIN'};
 DeliveryArt.prop = (object,state) => {
  const {id,x,y,w,h} = object;
  if(exits[id])return frame(x,y+h-48,w,46,'#172536','#668197')+text(x+w/2,y+h-20,exits[id],13);
  if(id==='notice')return frame(x,y,w,h,'#202b3d')+text(x+w/2,y+29,'ROUTE BOARD',16,gold)+
   [['NORTH BRIDGE',blue],['MILL ROAD',gold],['DEPOT','#c9a5ff']].map(([label,color],i)=>
    `<circle cx="${x+26}" cy="${y+58+i*35}" r="6" fill="${color}"/>${text(x+119,y+63+i*35,label,13)}`).join('');
  if(id==='fuse')return `<svg x="${x+25}" y="${y+10}" width="62" height="50" overflow="visible" viewBox="0 0 90 90">${DeliveryArt.icons.fuse}</svg>`;
  if(id==='panel')return frame(x,y,w,h)+text(x+w/2,y+30,'SIGNAL PANEL',16)+
   frame(x+38,y+54,w-76,71,'#0a1422')+light(x+w/2,y+89,state.flags.powered?blue:'#ed795e')+
   text(x+w/2,y+159,state.flags.powered?'POWER RESTORED':'NO POWER',14);
  if(id==='lever')return `<path d="M854 350v157" stroke="#506175" stroke-width="12"/>`+
   frame(812,331,84,63,ink)+light(854,362,state.flags.signalSet?blue:'#71485a')+
   frame(781,452,135,41)+text(848,477,'SET ROUTE',14);
  return '';
 };
 DeliveryArt.ambient = scene => scene==='platform'?rain():'';
 const windows = Array.from({length:9},(_,i)=>frame(48+i*109,410,84,51,'#b89167','#344457')).join('');
 window.NightPlatformArt = {train:`<g class="night-train">
  <path d="M0 376H1064Q1146 378 1191 427L1229 474Q1247 500 1206 516H0Z" fill="#172c41" stroke="#55758d" stroke-width="5"/>
  <path d="M0 477H1226M0 487H1226" stroke="#bc8859" stroke-width="5"/>
  ${windows}<path d="M1060 410h48l61 50h-109Z" fill="#9bafbe" stroke="#4b5c72" stroke-width="4"/>
  ${light(1183,492,'#ffe6b5')}
 </g>`};
})();
