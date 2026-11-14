/* Original North Bridge sequel scenery, clues, token, and rescue cutscene. */
'use strict';
(function missionArt(){
 const steel='#405b72', cyan='#83daf0', gold='#f8c17a', silver='#d8eaf0';
 const text=(x,y,label,size=15,color=silver,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="600" letter-spacing="1.2" fill="${color}">${label}</text>`;
 const box=(x,y,w,h,fill='#172639',stroke=steel,r=9)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
 const glowing=(x,y,r=70,opacity=.7)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#ec-glow)" opacity="${opacity}"/>`;
 const flooring=(y=538)=>`<path d="M0 ${y}H1280V720H0Z" fill="url(#ec-floor)"/><g fill="none" stroke="#587085" opacity=".33" stroke-width="3"><path d="M0 ${y+45}H1280M0 ${y+99}H1280M0 ${y+150}H1280M160 ${y} 35 720M510 ${y} 473 720M835 ${y} 890 720M1100 ${y} 1230 720"/></g>`;
 const lamp=(x,y)=>`<path d="M${x} 130v${y-130}" stroke="#536373" stroke-width="5"/><path d="M${x-34} ${y}h68l-11-22h-46Z" fill="#bb9366"/>${glowing(x,y+14,75,.7)}<ellipse cx="${x}" cy="${y+8}" rx="14" ry="8" fill="${gold}"/>`;
 const rain=()=>`<g class="ec-rain">${Array.from({length:64},(_,i)=>{const x=(i*137+61)%1310, y=(i*89+33)%700;return `<path d="M${x} ${y}l-12 36" stroke="#a9d8ea" stroke-width="${1+i%2}" stroke-opacity="${.13+(i%4)*.04}"/>`;}).join('')}</g>`;
 DeliveryArt.defs+=`
 <linearGradient id="ec-sky" x2="0" y2="1"><stop stop-color="#070c19"/><stop offset=".55" stop-color="#16283e"/><stop offset="1" stop-color="#324659"/></linearGradient>
 <linearGradient id="ec-floor" x2="0" y2="1"><stop stop-color="#293c4e"/><stop offset="1" stop-color="#080f1e"/></linearGradient>
 <linearGradient id="ec-glass" x2="0" y2="1"><stop stop-color="#21465d"/><stop offset="1" stop-color="#0a182c"/></linearGradient>
 <radialGradient id="ec-glow"><stop stop-color="#ffd098" stop-opacity=".45"/><stop offset="1" stop-color="#ffd098" stop-opacity="0"/></radialGradient>
 <linearGradient id="ec-tunnel" x2="0" y2="1"><stop stop-color="#172a3b"/><stop offset="1" stop-color="#040915"/></linearGradient>`;
 const station=()=>`<rect width="1280" height="720" fill="url(#ec-sky)"/>
 <path d="M0 244L93 199l153 36 122-72 155 69 171-52 170 59 144-48 145 49 127-60v305H0Z" fill="#0d1827"/>
 <path d="M0 111H1280v57H0Z" fill="#0b1425" stroke="#485970" stroke-width="7"/>
 <path d="M45 169V541M207 169V541M801 169V541M1183 169V541" stroke="#4c6177" stroke-width="15"/>
 <path d="M0 485H1280" stroke="#8493a2" stroke-opacity=".35" stroke-width="4"/>
 <path d="M0 492H1280V554H0Z" fill="#1b2d3f"/>
 ${box(456,160,363,53,'#102134','#627489')}${text(636,195,'NORTH BRIDGE',24,gold)}
 <circle cx="644" cy="93" r="43" fill="#0b1727" stroke="#748da0" stroke-width="7"/>
 <path d="M644 64v29l-17 13" stroke="${cyan}" stroke-width="5" fill="none" stroke-linecap="round"/>
 ${lamp(149,252)}${lamp(1025,252)}`;
 DeliveryArt.home=()=>station()+`
 <path d="M0 535H1280" stroke="#b89b69" stroke-width="10" stroke-dasharray="20 12"/>${flooring(541)}
 <path d="M1055 274v238h185V274Z" fill="#091425" stroke="#52677b" stroke-width="7"/>
 <path d="M1139 281v222" stroke="#465b71" stroke-width="5"/>
 <path d="M1101 371h89" stroke="#66849a" stroke-width="5"/>
 ${glowing(1132,343,85,.5)}`;
 const windowPane=(x)=>`${box(x,210,177,203,'url(#ec-glass)','#425c70',10)}
 <path d="M${x+88} 213V410M${x+2} 308h173" stroke="#8298a9" stroke-width="5" opacity=".64"/>
 <path d="M${x+32} 227l-24 76m86-77-32 97m75-91-25 81" stroke="#acd8ec" opacity=".23" stroke-width="3"/>`;
 DeliveryArt.stall=()=>`
 <rect width="1280" height="720" fill="#0c1728"/>
 <path d="M0 141H1280V487H0Z" fill="#18283b"/>
 <path d="M0 163H1280M0 477H1280" stroke="#8a785b" stroke-width="7"/>
 ${windowPane(221)}${windowPane(469)}${windowPane(717)}
 <path d="M200 165v355M420 165v355M667 165v355M913 165v355" stroke="#4b6175" stroke-width="8"/>
 ${box(22,190,181,344,'#101f32')}${box(1069,190,184,344,'#111f30')}
 <path d="M228 445q76-33 164 0l-17 65H241Z" fill="#5c3d45" stroke="#927078" stroke-width="5"/>
 <path d="M263 510v53M359 510v53" stroke="#4e5261" stroke-width="12"/>
 <path d="M452 448q88-28 177 0l-17 65H470Z" fill="#5d404e" stroke="#997788" stroke-width="5"/>
 <path d="M491 512v52M604 512v52" stroke="#4d5364" stroke-width="12"/>
 <path d="M677 448q95-29 183 0l-17 65H697Z" fill="#5d4251" stroke="#977685" stroke-width="5"/>
 <path d="M706 513v53M826 513v53" stroke="#4d5364" stroke-width="12"/>
 ${flooring(555)}${lamp(622,205)}
 ${box(522,135,241,40,'#1c2d3e','#516a7e')}${text(642,162,'CAR 07  ·  LAST SERVICE',14,gold)}
 <path d="M947 226v314" stroke="#547183" stroke-width="10"/>`;
 DeliveryArt.platform=()=>`
 <rect width="1280" height="720" fill="#091323"/>
 <path d="M0 140H1280V526H0Z" fill="#17283a"/>
 <g stroke="#445a6a" stroke-width="6" opacity=".55"><path d="M0 193H1280M0 244H1280M0 295H1280M0 346H1280M0 397H1280M0 448H1280M0 499H1280"/></g>
 <path d="M0 193v320M237 193v320M500 193v320M829 193v320M1222 193v320" stroke="#24394c" stroke-width="16"/>
 ${box(1055,224,198,321,'url(#ec-tunnel)','#526e80',3)}
 <path d="M1073 229v308m55-308v308m55-308v308m55-308v308" stroke="#506778" stroke-width="6" opacity=".87"/>
 ${glowing(1148,344,105,.3)}${text(1152,251,'SERVICE GATE',14,gold)}
 <path d="M18 476h1080" stroke="#81939a" stroke-width="8" opacity=".32"/>
 <path d="M705 164v67m-80-67v67" stroke="#627688" stroke-width="7"/>${lamp(710,199)}
 ${flooring(530)}
 ${box(816,422,300,45,'#1a2f40','#6a899a')}${text(958,453,'CLOCK ROUTER',17,gold)}`;
 const tokenShape=`<circle cx="45" cy="45" r="31" fill="#ce9a50" stroke="#ffdc9b" stroke-width="5"/><circle cx="45" cy="45" r="23" fill="none" stroke="#80613b" stroke-width="3"/><path d="M30 59l15-32 15 32M36 47h18" stroke="#654a2b" stroke-width="4" fill="none"/><path d="M45 8v8m0 58v8M8 45h8m58 0h8" stroke="#fff0c4" stroke-width="3"/>`;
 DeliveryArt.icons.token=tokenShape;
 const exits={cross:'LAST CARRIAGE →',back:'← STATION',platform:'SERVICE CONTROL →',cabin:'← CAR 07'};
 DeliveryArt.prop=({id,x,y,w,h},state)=>{
  if(exits[id])return box(x,y+h-51,w,49,'#162739','#7794a1')+text(x+w/2,y+h-20,exits[id],12,gold);
  if(id==='notice')return box(x,y,w,h,'#142738','#7b9a9b')+
   text(x+w/2,y+29,'AFTER-HOURS DOORS',17,gold)+
   [['00:12','NORTHBOUND'],['00:17','SERVICE'],['00:21','FREIGHT YARD']].map(([t,n],i)=>text(x+55,y+73+i*38,t,15,cyan)+text(x+170,y+73+i*38,n,13,silver)).join('')+
   `<path d="M${x+15} ${y+46}H${x+w-15}" stroke="#5a7482" stroke-width="2"/>`;
  if(id==='note')return `<path d="M${x+13} ${y+20}l${w-48} -12 20 ${h-45} -${w-45} 17Z" fill="#d4c5a2" stroke="#8c745b" stroke-width="5"/><path d="M${x+48} ${y+53}h111m-104 25h92m-80 23h65" stroke="#59606b" opacity=".6" stroke-width="4"/>${text(x+98,y+43,'K',16,'#495c68')}`;
  if(id==='token')return `<svg x="${x+14}" y="${y}" width="82" height="77" viewBox="0 0 90 90">${tokenShape}</svg>`;
  if(id==='panel')return box(x,y,w,h,'#1c3542','#6a8794')+text(x+w/2,y+33,'CONTROL LOCK',16,gold)+
   `<circle cx="${x+w/2}" cy="${y+124}" r="44" fill="#0e202e" stroke="#b49458" stroke-width="7"/>`+
   (state.flags.unlocked?`<path d="M${x+76} ${y+125}h44" stroke="${cyan}" stroke-width="6"/>${glowing(x+97,y+125,70,.5)}`:
   `<circle cx="${x+w/2}" cy="${y+124}" r="18" stroke="#b49b72" stroke-width="5" fill="none"/><path d="M${x+97} ${y+107}v34" stroke="#c9a46e" stroke-width="5"/>`)+
   text(x+w/2,y+224,state.flags.unlocked?'ACCESS GRANTED':'TOKEN REQUIRED',13,state.flags.unlocked?cyan:gold);
  if(id==='lever')return box(x,y,w,h,'#111f30','#5c788a')+text(x+w/2,y+32,'PASSAGE TIME',16)+
   `<rect x="${x+24}" y="${y+50}" width="${w-48}" height="75" rx="9" fill="#071420" stroke="#617b8c" stroke-width="4"/>`+
   text(x+w/2,y+97,state.flags.rescued?'00:17':'--:--',29,state.flags.rescued?cyan:gold)+
   text(x+w/2,y+162,state.flags.rescued?'GATE OPEN':'SELECT TIME',14);
  return '';
 };
 DeliveryArt.ambient=scene=>scene==='stall'?'':rain()+`<path d="M-50 480Q200 438 427 483T938 480T1330 475" fill="none" stroke="#a9c3d3" stroke-opacity=".14" stroke-width="22" class="ec-fog"/>`;
 window.EmptyCarriageArt={reveal:`
 <g class="ec-rescue-aura"><circle cx="1150" cy="350" r="170" fill="url(#ec-glow)"/></g>
 <g class="ec-service-door"><rect x="1061" y="228" width="184" height="307" rx="3" fill="#1c3b50" stroke="#6d8c9d" stroke-width="6"/><path d="M1120 230v302m66-302v302" stroke="#7894a4" stroke-width="5"/></g>
 <g class="ec-rescued-group" fill="#182c3b" stroke="#a3c5ca" stroke-width="3">
 <circle cx="1089" cy="379" r="25" fill="#cfb7a5"/><path d="M1054 428q34-18 70 0l12 88h-98Z" fill="#516d7c"/>
 <circle cx="1184" cy="390" r="24" fill="#bb967e"/><path d="M1152 434q36-20 69 0l13 83h-90Z" fill="#796275"/>
 <path d="M1063 484l-20 65m73-65 20 65m34-55-22 65m54-65 22 65" stroke="#9db7c5" stroke-width="9"/>
 </g>
 <g class="ec-rescue-sparks">${Array.from({length:15},(_,i)=>`<circle cx="${1030+(i*61)%245}" cy="${245+(i*73)%250}" r="${1+i%3}" fill="${i%2?cyan:gold}"/>`).join('')}</g>`};
})();
