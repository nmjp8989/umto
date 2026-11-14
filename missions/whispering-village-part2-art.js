/* The Whispering Village · Part 2 — original moonlit detective scenes */
'use strict';
(function part2art(){
 const violet='#a3a9d6',gold='#e3bb86',cyan='#8bcfdf',pale='#dce8ee',line='#556b79';
 const text=(x,y,value,size=15,color=pale)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="650" font-size="${size}" letter-spacing="1.2" fill="${color}">${value}</text>`;
 const box=(x,y,w,h,fill='#1b2a3a',stroke='#5b7585')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
 const glow=(x,y,r=96)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#wvp-glow)"/>`;
 const stars=()=>`<g>${Array.from({length:70},(_,i)=>`<circle cx="${(i*191+9)%1280}" cy="${(i*83+21)%365}" r="${.7+i%2*.6}" fill="#dae8f3" opacity="${.17+(i%4)*.08}"/>`).join('')}</g>`;
 const trees=()=>Array.from({length:15},(_,i)=>{const x=(i*116+17)%1320, y=390+(i*17)%90;return `<path d="M${x} ${y+105}v-150m0 30-24-41m24 23 28-52" fill="none" stroke="${i%2?'#13242d':'#0e2426'}" stroke-width="16" stroke-linecap="round"/>`;}).join('');
 const sky=()=>`<rect width="1280" height="720" fill="url(#wvp-night)"/>${stars()}<circle cx="1048" cy="159" r="59" fill="#c5d8de" opacity=".72"/>${glow(1048,159,169)}<path d="M0 444q130-107 252-42t249-27t263 18t269-39t247 49v140H0Z" fill="#12212b"/>${trees()}`;
 const ground=(y=531)=>`<path d="M0 ${y}H1280V720H0Z" fill="url(#wvp-floor)"/><path d="M0 ${y+47}H1280M0 ${y+103}H1280M0 ${y+161}H1280M270 ${y} 145 720M580 ${y} 493 720M848 ${y} 923 720M1070 ${y} 1161 720" fill="none" stroke="#8a8f8a" stroke-width="3" opacity=".24"/>`;
 const house=(x,y,w,h,dark=true)=>`<path d="M${x-20} ${y+41}L${x+w/2} ${y-42} ${x+w+20} ${y+41}Z" fill="#14202e" stroke="#0b1523" stroke-width="8"/><rect x="${x}" y="${y+41}" width="${w}" height="${h-41}" fill="#273340" stroke="#121c28" stroke-width="8"/><rect x="${x+35}" y="${y+100}" width="${w*.27}" height="119" fill="${dark?'#0b1825':'#a58060'}" stroke="#6a7680" stroke-width="8"/><path d="M${x+35+w*.135} ${y+100}v119M${x+35} ${y+163}h${w*.27}" stroke="#607387" stroke-width="5"/><path d="M${x+w*.67} ${y+133}v${h-134}" stroke="#7991a0" stroke-width="8"/><rect x="${x+w*.64}" y="${y+130}" width="${w*.3}" height="${h-130}" fill="#122a3a" stroke="#6c8795" stroke-width="7"/><circle cx="${x+w*.87}" cy="${y+h-85}" r="6" fill="${gold}"/>`;
 const interior=(wall='#263644',floor=518)=>`<rect width="1280" height="720" fill="#111827"/><path d="M0 74h1280v${floor-74}H0Z" fill="${wall}"/><path d="M0 173h1280M0 337h1280" fill="none" stroke="#66717a" stroke-opacity=".29" stroke-width="5"/>${ground(floor)}<path d="M0 ${floor}h1280" stroke="#0c1725" stroke-width="13"/>`;
 const lamp=(x,y)=>`<path d="M${x} 0v${y}" stroke="#697584" stroke-width="6"/><path d="M${x-36} ${y}h72l-16-21h-40Z" fill="#8f7a5c"/>${glow(x,y+9,91)}<circle cx="${x}" cy="${y+10}" r="9" fill="${gold}"/>`;
 const tablet=(x,y,w,h,label,body)=>box(x,y,w,h,'#263745','#74838b')+text(x+w/2,y+31,label,15,gold)+text(x+w/2,y+72,body,13,cyan);
 const battery=`<rect x="15" y="24" width="60" height="53" rx="8" fill="#6c706b" stroke="#c7bf9c" stroke-width="5"/><path d="M30 23v-12h14v12m9 0v-12h14v12" fill="#c5bb99" stroke="#807d68" stroke-width="4"/><path d="M45 34l-8 20h12l-5 14 20-25H50l8-9Z" fill="#ffe3a0"/>`;
 const wire=`<path d="M18 45q10-33 24 0t28 0t16-10" stroke="#d18b51" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M10 42h16m57-7h6" stroke="#899ca1" stroke-width="12"/><path d="M23 46q10-22 18 0t29 0" stroke="#ffe0a0" stroke-width="3" fill="none"/>`;
 DeliveryArt.defs+=`
 <linearGradient id="wvp-night" x2="0" y2="1"><stop stop-color="#060917"/><stop offset=".64" stop-color="#1b2841"/><stop offset="1" stop-color="#465363"/></linearGradient>
 <linearGradient id="wvp-floor" x2="0" y2="1"><stop stop-color="#323b49"/><stop offset="1" stop-color="#08121f"/></linearGradient>
 <radialGradient id="wvp-glow"><stop stop-color="#ffe0a4" stop-opacity=".32"/><stop offset="1" stop-color="#ffe0a4" stop-opacity="0"/></radialGradient>
 <linearGradient id="wvp-lamp"><stop stop-color="#f8dfaf" stop-opacity=".7"/><stop offset="1" stop-color="#f8dfaf" stop-opacity="0"/></linearGradient>`;
 DeliveryArt.icons.battery=battery;DeliveryArt.icons.wire=wire;
 DeliveryArt.home=()=>sky()+
 `${house(27,269,247,267,false)}${house(343,249,253,278)}${house(765,243,307,280)}${ground(530)}
 <path d="M0 540L90 497 236 532 300 505 501 537 605 496 822 532 1073 504 1280 536" fill="none" stroke="#101e2a" stroke-width="13"/>
 ${lamp(629,221)}${glow(1010,314,126)}<path d="M30 550l60 0m16 24 94 0m912 15 116 0" stroke="#a3bfc2" opacity=".25" stroke-width="4"/>
 <g class="wvp-window-ghost"><circle cx="435" cy="366" r="6" fill="#f3b874"/><circle cx="456" cy="366" r="6" fill="#f3b874"/></g>`;
 DeliveryArt.stall=()=>interior('#273542',518)+`
 ${box(10,201,183,338,'#102033','#536e7d')}
 ${box(225,151,320,266,'#162331','#8797a0')}${glow(386,298,152)}
 <path d="M240 381q102-152 173 0m-7-101 81-66" stroke="#63717a" stroke-width="6" fill="none"/>
 ${box(594,274,272,266,'#182c39','#738492')}
 <path d="M624 365h209m-209 58h209m-209 58h209" stroke="#728990" stroke-width="6" opacity=".7"/>
 <path d="M1010 281V541M1197 281V541" stroke="#61798a" stroke-width="13"/>
 ${lamp(917,205)}<path d="M974 506L1210 506" stroke="#a18159" stroke-width="13"/>`;
 DeliveryArt.yard=()=>sky()+
 `<path d="M0 350h1280v190H0Z" fill="#23313c"/>
 ${house(43,311,260,229)}${house(899,307,287,231)}
 ${ground(541)}
 <path d="M215 559q220 50 441 0t490 34" stroke="#aecdd0" stroke-width="5" opacity=".15" fill="none"/>
 <ellipse cx="440" cy="489" rx="136" ry="49" fill="#132b39" stroke="#5b7b86" stroke-width="7"/>
 <path d="M306 485h270m-131-40v96" stroke="#83959b" stroke-width="6"/>
 <path d="M993 348v182" stroke="#617b87" stroke-width="13"/>${glow(1091,402,97)}
 ${text(1037,303,'DRAINPIPE',16,gold)}`;
 DeliveryArt.shed=()=>interior('#403a3c',526)+`
 ${box(219,191,343,279,'#2b2f34','#998372')}
 <path d="M234 231h313M234 301h313M234 371h313" stroke="#917d69" stroke-width="13"/>
 <path d="M283 221V456M491 221V456" stroke="#8a7463" stroke-width="16"/>
 ${box(639,343,236,169,'#423f3b','#c2a278')}
 ${lamp(944,153)}
 <circle cx="1111" cy="336" r="89" fill="#202e38" stroke="#988375" stroke-width="11"/>
 <circle cx="1111" cy="336" r="65" fill="#18242e" stroke="#536c73" stroke-width="5"/>
 <path d="M1064 325v-33m46 40v-40m43 53v-35" stroke="#ac9882" stroke-width="14"/>
 ${glow(813,367,125)}`;
 DeliveryArt.platform=()=>interior('#1e3445',533)+`
 <path d="M0 175h1280M0 292h1280M0 409h1280" stroke="#354e5f" stroke-width="18"/>
 <path d="M332 164v389m245-389v389m237-389v389m261-389v389" stroke="#192b3b" stroke-width="17"/>
 ${box(422,219,257,242,'#1a2938','#6d8999')}
 <circle cx="557" cy="339" r="74" fill="#0c2030" stroke="#768791" stroke-width="7"/>
 <path d="M509 341q30-27 56 0t51 1" stroke="#7895a5" fill="none" stroke-width="9"/>
 <path d="M1059 242v292" stroke="#59798d" stroke-width="17"/>${lamp(1022,166)}
 ${glow(1098,403,120)}`;
 const labels={back:'← NEEM LANE',cabin:'← EMPTY HOUSE',cross:'EMPTY HOUSE →',yardGate:'REAR COURTYARD →',shedPath:'GRAIN SHED →'};
 DeliveryArt.prop=(o,s)=>{
 const {id,x,y,w,h}=o,flags=s.flags||{};
 if(labels[id])return box(x,y+h-53,w,50,'#102636','#78949f')+text(x+w/2,y+h-22,labels[id],12,gold);
 if(id==='kabir')return `<path d="M${x+20} ${y+h-42}h${w-40}" stroke="#94aabb" opacity=".45" stroke-width="3" stroke-dasharray="8 9"/>${text(x+w/2,y+19,'KABIR · TALK',14,gold)}`;
 if(id==='shutter')return box(x,y,w,h,'#192c3a','#8a9e9d')+`<path d="M${x+w/2} ${y+6}v${h-12}M${x+8} ${y+h/2}h${w-16}M${x+22} ${y+21}l${w-44} ${h-42}" stroke="#5f8091" stroke-width="8"/><circle cx="${x+w*.31}" cy="${y+h*.43}" r="5" fill="${gold}"/><circle cx="${x+w*.41}" cy="${y+h*.43}" r="5" fill="${gold}"/>`;
 if(id==='diagram')return tablet(x,y,w,h,'COPPER SIGNAL PIPE','GRAIN SHED ↔ CELLAR')+`<path d="M${x+35} ${y+125}h${w-70}m-55-14 32 14-32 14" stroke="${cyan}" stroke-width="8" fill="none"/>`;
 if(id==='panel')return box(x,y,w,h,'#1a2935','#728e9b')+text(x+w/2,y+36,'SIGNAL RELAY',16,gold)+`<circle cx="${x+w/2}" cy="${y+113}" r="48" fill="#071822" stroke="#6e8394" stroke-width="7"/><circle cx="${x+w/2}" cy="${y+113}" r="${flags.powered?15:9}" fill="${flags.powered?'#b7d7af':'#7c4e45'}"/>${text(x+w/2,y+194,flags.wired?'ONLINE':flags.powered?'WIRE MISSING':'NO POWER',15,flags.wired?cyan:gold)}`;
 if(id==='hatch')return box(x,y,w,h,'#11202c','#73899c')+`<path d="M${x+36} ${y+16}v${h-37}m24 -${h-37}v${h-37}m24 0v${h-37}m24 0v${h-37}" stroke="#648090" stroke-width="11"/><circle cx="${x+w-39}" cy="${y+h/2}" r="9" fill="${flags.wired?cyan:'#956b4e'}"/>${text(x+w/2,y+h-17,flags.wired?'RELAY OPEN':'LOCKED STAIR',13,gold)}`;
 if(id==='tracks')return `<g fill="#556973" opacity=".85">${Array.from({length:6},(_,i)=>`<ellipse cx="${x+34+i*46}" cy="${y+25+(i%2)*31}" rx="16" ry="27" transform="rotate(-16 ${x+34+i*46} ${y+25+(i%2)*31})"/>`).join('')}</g>`+text(x+w/2,y+h-11,'FOLLOW FOOTPRINTS',14,gold);
 if(id==='wire')return `<svg x="${x+8}" y="${y+15}" width="${w-16}" height="${h-24}" viewBox="0 0 90 90">${wire}</svg>`;
 if(id==='pipe')return `<path d="M${x+w/2} ${y+15}v${h-38}m-35 0h70" stroke="#778991" stroke-width="21" fill="none"/>${text(x+w/2,y+35,'PIPE',16,gold)}`;
 if(id==='ledger')return box(x,y,w,h,'#93856b','#e0c696')+text(x+w/2,y+29,'CARETAKER LOG',16,'#2a3137')+text(x+w/2,y+86,'LONG · short · short',16,'#263340')+`<path d="M${x+25} ${y+114}h${w-50}m-${w-50} 32h${w-50}" stroke="#5b5b5b" stroke-width="4"/>`;
 if(id==='battery')return `<svg x="${x+15}" y="${y+5}" width="${w-30}" height="${h-10}" viewBox="0 0 90 90">${battery}</svg>`;
 if(id==='drum')return `<circle cx="${x+w/2}" cy="${y+102}" r="66" fill="#203b46" stroke="#a99069" stroke-width="9"/><path d="M${x+w/2-50} ${y+67}h100m-100 36h100m-100 36h100" stroke="#5f8e9b" stroke-width="5"/>${text(x+w/2,y+h-21,'CODE DRUM',15,gold)}`;
 if(id==='knocker')return box(x,y,w,h,'#152d3e','#8499a2')+`<path d="M${x+43} ${y+45}h${w-86}m-${w/2-43} 49h${w-86}m-${w-86} 43h${w-86}" stroke="#bda37b" stroke-width="7"/>${text(x+w/2,y+h-19,'LISTEN',14,gold)}`;
 if(id==='switch')return box(x,y,w,h,'#142633','#77919c')+text(x+w/2,y+36,'SIGNAL KEY',16,gold)+`<circle cx="${x+w/2}" cy="${y+124}" r="50" fill="#0b1928" stroke="#86a1a6" stroke-width="6"/><path d="M${x+w/2} ${y+124}l28-25" stroke="${flags.rescuedCaretaker?cyan:gold}" stroke-width="9" stroke-linecap="round"/>${text(x+w/2,y+h-19,flags.rescuedCaretaker?'DOOR OPEN':'SEND KNOCKS',13,gold)}`;
 return '';
 };
 DeliveryArt.ambient=()=>`<g class="wvp-mist" fill="none" stroke="#bad4db" stroke-opacity=".13"><path d="M-80 456q268-47 524 0t498-11t450 2" stroke-width="24"/><path d="M-80 512q270 29 537 0t519 0t441 0" stroke-width="11"/></g>`;
 window.WhisperingVillagePart2Art={
 reveal:`<g class="wvp-reveal"><circle cx="1109" cy="359" r="151" fill="url(#wvp-glow)"/><path d="M1028 246l165 0v278h-165Z" fill="#264357" stroke="#a3b8b4" stroke-width="10"/><path d="M1054 267v225m56-225v225m55-225v225" stroke="#718e99" stroke-width="5"/><circle cx="1121" cy="373" r="27" fill="#ba9b86"/><path d="M1084 417q36-31 74 0l21 123h-113Z" fill="#425b65" stroke="#8597a3" stroke-width="6"/><path d="M1090 533l-8 83m70-83 13 83" stroke="#4c6671" stroke-width="14"/><path d="M1060 326l-63 34" stroke="#b8ad92" stroke-width="10"/><circle cx="986" cy="361" r="15" fill="#bd9d85"/></g>`
 };
})();
