/* UMTO Mission 008 — original illustrated six-scene midnight village. */
'use strict';
(function art008(){
 const ink='#091122', slate='#17283a', gold='#ffd39b', blue='#8dd6e5', pale='#d9e5ef', moss='#405f50';
 const text=(x,y,s,z=16,c=pale)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="650" font-size="${z}" letter-spacing="1.3" fill="${c}">${s}</text>`;
 const rect=(x,y,w,h,c='#182638',stroke='#4f6678',r=7)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" stroke="${stroke}" stroke-width="4"/>`;
 const glow=(x,y,r=85,c='wv-goldglow')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${c})"/>`;
 const stars=()=>`<g>${Array.from({length:60},(_,i)=>{const x=(i*263+53)%1280,y=(i*127+11)%365;return `<circle cx="${x}" cy="${y}" r="${.6+i%3*.4}" fill="#d9e8ff" opacity="${.12+(i%5)*.09}"/>`;}).join('')}</g>`;
 const trees=()=>Array.from({length:13},(_,i)=>{const x=i*115-25,h=87+(i*57)%140;return `<path d="M${x-23} 505l${23} -${h} 23 ${h}m-23 -${h*.75}l-27 ${h*.37}m27 -${h*.37}l31 ${h*.40}" stroke="${i%2?'#111f25':'#142b2b'}" stroke-width="${11+i%4*2}" stroke-linecap="round" fill="none"/>`;}).join('');
 const sky=()=>`<rect width="1280" height="720" fill="url(#wv-night)"/>${stars()}<circle cx="1056" cy="136" r="62" fill="#d8e8e6" opacity=".75"/>${glow(1056,136,178,'wv-moonhalo')}<path d="M0 399Q150 298 293 381T666 367T1047 363T1340 353V555H0Z" fill="#101f2c"/>${trees()}`;
 const stones=(y=527)=>`<path d="M0 ${y}H1280V720H0Z" fill="url(#wv-ground)"/><path d="M0 ${y+28}H1280M0 ${y+76}H1280M0 ${y+135}H1280M260 ${y} 150 720M515 ${y} 475 720M780 ${y} 838 720M1030 ${y} 1175 720" stroke="#6d7580" stroke-opacity=".26" stroke-width="3" fill="none"/>`;
 const road=()=>`<path d="M435 405H814L1367 720H-160Z" fill="#1a2631"/><path d="M570 450L485 720M675 450L743 720" stroke="#596875" stroke-opacity=".55" stroke-dasharray="23 29" stroke-width="5"/>${Array.from({length:12},(_,i)=>`<path d="M${i*132} 620l48-6" stroke="#aec5ca" stroke-width="3" opacity=".13"/>`).join('')}`;
 const lanternSvg=`<path d="M45 11q-17 0-17 17" stroke="#c6a073" stroke-width="6" fill="none"/><path d="M26 25h38l8 43H18Z" fill="#533824" stroke="#ffd18a" stroke-width="5"/><path d="M29 30h32l-4 30H33Z" fill="#ffc85c"/><path d="M45 33v24" stroke="#fff4b2" stroke-width="7"/><path d="M21 70h48" stroke="#4e3f2a" stroke-width="8"/>`;
 const keySvg=`<circle cx="32" cy="35" r="19" stroke="#becbd0" stroke-width="11" fill="none"/><path d="M51 35h34m-13 0v15m-13-15v10" stroke="#b7c4ca" stroke-width="10" fill="none" stroke-linecap="square"/>`;
 const threadSvg=`<circle cx="47" cy="47" r="26" fill="#a53c48" stroke="#d97469" stroke-width="4"/><path d="M24 36q26 2 45 15m-42 5q29-17 36-27m-14 41q-3-42 7-47m-23-1q26 21 31 35" stroke="#f2a2a5" stroke-width="4" fill="none"/><path d="M68 61q16 10 9 18t-28 5" stroke="#bd5360" stroke-width="5" fill="none"/>`;
 const motorbike=`<g stroke-linecap="round" stroke-linejoin="round"><g fill="#0b1320" stroke="#94a5a7" stroke-width="7"><circle cx="86" cy="144" r="40"/><circle cx="330" cy="144" r="40"/></g><g stroke="#536d7f" stroke-width="11" fill="none"><path d="M86 144l70-72 92 72-162 0 84-72 81 0 79 72-49-95"/><path d="M330 144l-48-95m-6-15h70"/></g><path d="M163 79q36-37 103 0l-8 32h-110Z" fill="#6f3440" stroke="#be6875" stroke-width="5"/><path d="M162 58h103l35 18H158Z" fill="#111927"/><path d="M231 76h45v51h-45Z" fill="#171f25" stroke="#58626c" stroke-width="6"/><path d="M110 145h131" stroke="#9fa1a0" stroke-width="9"/><path d="M331 97h31l19 14h-42Z" fill="${gold}"/><path d="M371 108l50-26v54Z" fill="url(#wv-headbeam)" opacity=".73"/><circle cx="86" cy="144" r="11" fill="#9fb7be"/><circle cx="330" cy="144" r="11" fill="#9fb7be"/></g>`;
 const house=(x,y,w,h,type)=>{
  const blueDoor=type==='blue',weaver=type==='weaver';
  const fill=blueDoor?'#233044':weaver?'#4b393c':'#4e4643';
  const roof=blueDoor?'#1b2440':weaver?'#33282e':'#34272a';
  const dx=x+w*.62,dw=w*.23;
  return `<g class="wv-building">
  <path d="M${x-20} ${y+35}L${x+w/2} ${y-53} ${x+w+21} ${y+35}Z" fill="${roof}" stroke="#101523" stroke-width="8"/>
  <path d="M${x-11} ${y+35}h${w+22}" stroke="#738078" stroke-width="9"/>
  <rect x="${x}" y="${y+35}" width="${w}" height="${h-35}" fill="${fill}" stroke="#1e2834" stroke-width="8"/>
  <path d="M${x+17} ${y+76}l32-23m${w-52} 48 21-25m-${w*.35} 124 25 22m${w*.2} 48-31 20" stroke="#101b27" opacity=".5" stroke-width="5"/>
  <rect x="${x+26}" y="${y+91}" width="${w*.28}" height="${h*.3}" fill="#172d33" stroke="#5c6568" stroke-width="8"/>
  ${glow(x+w*.42,y+135,66,'wv-goldglow')}
  <path d="M${x+26+w*.14} ${y+91}v${h*.3}m-${w*.14} -${h*.15}h${w*.28}" stroke="#546771" stroke-width="5"/>
  <rect x="${dx}" y="${y+113}" width="${dw}" height="${h-116}" rx="3" fill="${blueDoor?'#17486a':weaver?'#2a2b34':'#382d29'}" stroke="${blueDoor?'#7ba1b8':'#8d796b'}" stroke-width="7"/>
  <circle cx="${dx+dw*.83}" cy="${y+113+(h-116)*.51}" r="5" fill="#e1b879"/>
  <path d="M${x} ${y+h}h${w}" stroke="#53605d" stroke-width="12"/>
  <path d="M${x+14} ${y+h+2}q${w/2} 19 ${w-25} 0" stroke="#30363f" stroke-width="5" fill="none"/>
  ${text(x+w/2,y+h-19,blueDoor?'THE BLUE DOOR':weaver?'WEAVER HOUSE':'BIBI NOOR',13,'#d6c3a1')}
  </g>`;
 };
 const interior=(wall='#293845',floor=510)=>`<rect width="1280" height="720" fill="#0b1423"/><rect width="1280" height="${floor}" fill="${wall}"/>
 <path d="M0 155H1280M0 387H1280" stroke="#566069" opacity=".28" stroke-width="6"/>
 <path d="M74 90V${floor}M1200 90V${floor}" stroke="#172230" stroke-width="23"/>${stones(floor)}
 <path d="M0 ${floor}H1280" stroke="#161b26" stroke-width="14"/>`;
 const window=(x,y,w=167,h=204,lit=false)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${lit?'#947f60':'#102a3f'}" stroke="#1c232b" stroke-width="12"/><path d="M${x+w/2} ${y}v${h}M${x} ${y+h/2}h${w}" stroke="#718390" stroke-width="7"/>${lit?glow(x+w/2,y+h/2,114):''}<path d="M${x+20} ${y+17}l-12 43m65-39-21 63" stroke="#d2e8f1" opacity=".17" stroke-width="4"/>`;
 const door=(x=20,y=320)=>rect(x,y,176,246,'#162536','#658094',7)+`<path d="M${x+28} ${y+14}h120v209H${x+28}Z" fill="#0e1b2c"/><circle cx="${x+135}" cy="${y+125}" r="5" fill="#e7ba79"/>`;
 const back=()=>rect(20,520,191,46,'#132538','#6b8f9b',7)+text(114,549,'← NEEM LANE',13,gold);
 const vines=(x)=>`<path d="M${x} 0q-35 70 7 126t-8 95m-36-140 36 13m-5 77 30-20" stroke="#34493d" stroke-width="11" fill="none"/>`;
 DeliveryArt.defs+=`
 <linearGradient id="wv-night" x2="0" y2="1"><stop stop-color="#020717"/><stop offset=".59" stop-color="#142239"/><stop offset="1" stop-color="#465461"/></linearGradient>
 <linearGradient id="wv-ground" x2="0" y2="1"><stop stop-color="#2c353e"/><stop offset="1" stop-color="#090f19"/></linearGradient>
 <radialGradient id="wv-goldglow"><stop stop-color="#ffca76" stop-opacity=".48"/><stop offset="1" stop-color="#ffca76" stop-opacity="0"/></radialGradient>
 <radialGradient id="wv-moonhalo"><stop stop-color="#bdcfea" stop-opacity=".13"/><stop offset="1" stop-color="#bdcfea" stop-opacity="0"/></radialGradient>
 <linearGradient id="wv-headbeam"><stop stop-color="#ffedac" stop-opacity=".75"/><stop offset="1" stop-color="#ffedac" stop-opacity="0"/></linearGradient>
 <radialGradient id="wv-wellvoid"><stop stop-color="#122a39"/><stop offset="1" stop-color="#010714"/></radialGradient>`;
 DeliveryArt.icons.lantern=lanternSvg;
 DeliveryArt.icons.thread=threadSvg;
 DeliveryArt.icons.key=keySvg;
 DeliveryArt.home=()=>sky()+`<path d="M0 435l245-38 180 70 205-26 200 41 250-30 200 20v60H0Z" fill="#202e34"/>
 <path d="M20 395v200m105 3v-167" stroke="#273d34" stroke-width="28"/>${road()}
 <path d="M51 514h202l-15 106H39Z" fill="#192b31" stroke="#42565d" stroke-width="7"/>
 <path d="M54 498l22-62h162l-10 62" fill="#2a3436" stroke="#667572" stroke-width="6"/>
 ${glow(830,416,127,'wv-moonhalo')}
 <path d="M1045 452l24-71 25 71m-42-12h36" stroke="#141e27" stroke-width="15"/>`;
 DeliveryArt.lane=()=>sky()+`
 ${house(30,244,267,304,'bibi')}${house(352,252,266,294,'weaver')}${house(737,247,265,298,'blue')}
 <path d="M0 508H1280v38H0Z" fill="#131b27" opacity=".63"/>
 ${stones(544)}
 <path d="M38 544v138m304-138-40 170m437-170 45 170m270-170 90 165" stroke="#778181" opacity=".19" stroke-width="6"/>
 ${glow(168,337,105)}${vines(1134)}
 <path d="M1050 462q95-53 191 0" fill="none" stroke="#172c30" stroke-width="16"/>
 <ellipse cx="1151" cy="471" rx="91" ry="36" fill="#0c1727" stroke="#64706c" stroke-width="10"/>
 <path d="M1090 471v55m122-55v55" stroke="#5d6460" stroke-width="11"/>
 ${text(1132,549,'OLD WELL',15,'#8ea4aa')}
 <g class="wv-watch-eyes"><circle cx="705" cy="367" r="4" fill="#ea9d72"/><circle cx="719" cy="367" r="4" fill="#ea9d72"/></g>`;
 DeliveryArt.bibi=()=>interior('#4b4442',528)+`
 <path d="M0 90H1280M0 197H1280M0 365H1280" stroke="#80736a" stroke-width="4" opacity=".35"/>
 ${window(491,170,182,199,true)}${vines(1188)}
 ${door()}
 ${rect(273,234,219,191,'#756659','#a5967d')}
 ${glow(691,388,101)}${rect(628,501,143,23,'#6d4637','#aa7855')}
 <path d="M666 515v76m77-76v76" stroke="#45362f" stroke-width="14"/>
 <path d="M766 425q61-65 105 18" stroke="#bba78e" fill="none" stroke-width="11" opacity=".7"/>
 <path d="M830 517q119-51 237 0" stroke="#353f38" stroke-width="17" fill="none"/>`;
 DeliveryArt.weaver=()=>interior('#403b40',531)+`
 ${door()}${window(1021,170,193,256)}
 <path d="M209 477H945" stroke="#1b232d" stroke-width="11"/>
 ${rect(264,303,361,217,'#2b2531','#8d6952')}
 <path d="M280 320v182m320-182v182m-320-180h320m-320 65h320m-320 69h320" stroke="#b0885b" stroke-width="13"/>
 <path d="M305 319q140 170 270 0m-270 182q140-167 270 0" stroke="#ae4852" stroke-width="9" fill="none"/>
 <path d="M735 494l38 29-14 31" stroke="#3c424a" stroke-width="15" fill="none"/>
 ${glow(1090,325,107,'wv-moonhalo')}
 <path class="wv-curtain" d="M1041 170Q1101 260 1043 417l49 0q69-143 41-247Z" fill="#667786" opacity=".55"/>`;
 DeliveryArt.well=()=>sky()+`
 <path d="M0 490H1280V720H0Z" fill="#18232a"/>${stones(550)}
 <path d="M409 420v100m360-100v100" stroke="#697269" stroke-width="17"/>
 <path d="M376 409q185-128 405 0" stroke="#344842" stroke-width="21" fill="none"/>
 <path d="M415 450q154-87 332 0l-24 82q-154 70-281 0Z" fill="#66706a" stroke="#273638" stroke-width="8"/>
 <ellipse cx="588" cy="444" rx="166" ry="81" fill="url(#wv-wellvoid)" stroke="#94a09a" stroke-width="15"/>
 <ellipse cx="588" cy="457" rx="116" ry="53" fill="#0a1923"/>
 <path d="M521 473q78-16 140 0" stroke="#7aa8b9" opacity=".2" stroke-width="6"/>
 <path d="M439 415v-190m313 190V225m-317-1h321" stroke="#403b33" stroke-width="19"/>
 <path d="M740 228v97" stroke="#746d58" stroke-width="7"/>
 <path d="M734 324h45q-18 21-22 32h-10Z" fill="#a17d5b"/>
 ${glow(751,345,64)}
 ${text(584,258,'THE OLD WELL',20,gold)}
 <path d="M711 429l84-22 16 28-80 25" fill="#8d7863" stroke="#2a3436" stroke-width="7"/>`;
 DeliveryArt.blue=()=>interior('#293947',523)+`
 ${door()}
 ${window(545,151,168,186)}
 ${rect(280,190,285,231,'#1b2534','#997958',4)}
 <path d="M308 368q56-80 105-42 35-96 104-19v84H308Z" fill="#464e55"/>
 <circle cx="420" cy="293" r="31" fill="#7b7474"/>
 <path d="M375 358q47-51 89 0" fill="#272f3a"/>
 <path d="M812 88l-15 263m-35-225 46 28" stroke="#182533" stroke-width="20"/>
 <path d="M742 389L1015 389l80 132H675Z" fill="#1b2835" stroke="#73818c" stroke-width="7"/>
 <path d="M776 414l246 0M755 465l287 0" stroke="#465764" stroke-width="7"/>
 ${glow(1047,240,118,'wv-moonhalo')}
 ${vines(1232)}
 <path d="M1117 555q-44-19-108 0" stroke="#697476" stroke-opacity=".56" stroke-width="5" fill="none"/>`;
 const nav=(x,y,w,h,s)=>rect(x,y+h-52,w,49,'#102437','#6a8999')+text(x+w/2,y+h-21,s,13,gold);
 const motorcycleAt=(x,y,w,h)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 420 190" overflow="visible">${motorbike}</svg>`;
 DeliveryArt.prop=(o,state)=>{
  const {id,x,y,w,h}=o;
  if(id==='back')return nav(x,y,w,h,'← NEEM LANE');
  if(id==='bike')return motorcycleAt(x,y,w,h);
  if(id==='sign')return `<path d="M${x+31} ${y+36}v${h-10}m${w-61} -${h-10}v${h-5}" stroke="#544237" stroke-width="16"/>${rect(x+8,y+37,w-16,85,'#5d5547','#b6a17f')}${text(x+w/2,y+76,'NEEM VILLAGE',19,'#f2dcad')}${text(x+w/2,y+102,'3 KM →',15,pale)}`;
  if(id==='headlight')return `<path d="M${x+70} ${y+30}q55-65 108 10" stroke="#4e6877" opacity=".4" stroke-width="5" fill="none"/>${glow(x+95,y+112,122,'wv-moonhalo')}<path d="M${x+78} ${y+107}q38-30 76 0" stroke="#1d292d" stroke-width="12" fill="none"/>`;
  if(id==='houseBibi')return `<path d="M${x+41} ${y+104}l10-32 12 32" stroke="#ffd78a" stroke-width="5" fill="none"/>${glow(x+122,y+119,100)}${nav(x+30,y+2,w-60,h-5,'BIBI NOOR →')}`;
  if(id==='houseWeaver')return nav(x+24,y+1,w-48,h-5,'WEAVER HOUSE →');
  if(id==='houseBlue')return rect(x+128,y+144,93,97,'#194364','#81a2b4')+text(x+w/2,y+28,state.flags.gateOpen?'BLUE DOOR OPEN':'THE BLUE DOOR',15,state.flags.gateOpen?blue:gold);
  if(id==='wellPath')return `<ellipse cx="${x+w/2}" cy="${y+h-66}" rx="92" ry="36" fill="#0c1824" stroke="#7e8f8c" stroke-width="11"/>${nav(x+5,y-3,w-10,h-5,'OLD WELL →')}`;
  if(id==='bibi')return `<path d="M${x+47} ${y+220}q45 11 88 0" stroke="#ccba8e" opacity=".5" stroke-width="5" fill="none"/>${text(x+w/2,y+28,'BIBI NOOR',18,gold)}`;
  if(id==='marks')return rect(x,y,w,h,'#756559','#91837b')+`<path d="M${x+41} ${y+39}l7 60m38-61 7 61m38-61 7 62M${x+91} ${y+111}v32m-17-13 17 16 17-16" stroke="#d6d4bf" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  if(id==='lantern')return glow(x+w/2,y+h/2,90)+`<svg x="${x+11}" y="${y+11}" width="${w-22}" height="${h-17}" viewBox="0 0 90 90">${lanternSvg}</svg>`;
  if(id==='loom')return `<path d="M${x+24} ${y+8}v${h-22}m${w-49} -${h-22}v${h-19}M${x+24} ${y+34}h${w-49}M${x+24} ${y+104}h${w-49}" stroke="#b69576" stroke-width="9"/><path d="M${x+54} ${y+52}q${w*.4} 160 ${w-102} 0" stroke="#ca5865" stroke-width="9" fill="none"/>${text(x+w/2,y+h-12,'ABANDONED LOOM',14,gold)}`;
  if(id==='thread')return `<svg x="${x+32}" y="${y+8}" width="${w-64}" height="${h-16}" viewBox="0 0 90 90">${threadSvg}</svg>`;
  if(id==='shadow')return `<path class="wv-shadow" d="M${x+38} ${y+238}q-8-89 36-127l-11-39q20-25 42 0l-12 39q41 33 42 127" fill="#0a1421" opacity=".48"/>`;
  if(id==='bell')return `<path d="M${x+w/2} ${y}v${h*.48}" stroke="#8b856e" stroke-width="7"/><path class="wv-bell" d="M${x+34} ${y+h*.61}q37-94 75 0l17 39h-109Z" fill="#8d785b" stroke="#d1ac73" stroke-width="5"/><circle cx="${x+w/2}" cy="${y+h*.82}" r="10" fill="#a78157"/>`;
  if(id==='well')return `<ellipse cx="${x+w/2}" cy="${y+h/2-8}" rx="${w*.48}" ry="${h*.40}" fill="url(#wv-wellvoid)" stroke="#87978d" stroke-width="13"/>${state.flags.sawGlimmer?glow(x+w/2,y+h/2,105):''}${state.flags.sawGlimmer?`<path d="M${x+w/2-13} ${y+h/2}l12-16 13 16-13 15Z" fill="${gold}"/>`:''}${text(x+w/2,y+h-14,'LOOK INTO THE WELL',14,gold)}`;
  if(id==='crank')return `<path d="M${x+28} ${y+h-18}V${y+47}h${w-56}" stroke="#6c7067" stroke-width="17" fill="none"/><circle cx="${x+w*.67}" cy="${y+46}" r="27" stroke="#af9980" stroke-width="9" fill="#142b34"/><path d="M${x+w*.67} ${y+46}l29-40" stroke="#bd9270" stroke-width="9"/>${text(x+w/2,y+h-24,'TURN WINCH',14,gold)}`;
  if(id==='portrait')return rect(x,y,w,h,'#111e2d','#ad8961',3)+`<circle cx="${x+w*.5}" cy="${y+54}" r="27" fill="#776b67"/><path d="M${x+w*.25} ${y+h-13}q${w*.26} -130 ${w*.5} 0Z" fill="#56636b"/><path d="M${x+55} ${y+h-16}h${w-110}" stroke="#b7a47b" stroke-width="6"/>`;
  if(id==='clock')return `<circle cx="${x+w/2}" cy="${y+95}" r="66" fill="#0c1929" stroke="#ad8c69" stroke-width="10"/><circle cx="${x+w/2}" cy="${y+95}" r="5" fill="#eac69a"/><path d="M${x+w/2} ${y+95}v-44m0 44 38-2" stroke="#d2c4a9" stroke-width="8" stroke-linecap="round"/><path d="M${x+w/2-24} ${y+170}h48" stroke="#887055" stroke-width="7"/>${text(x+w/2,y+209,'MIDNIGHT',14,gold)}`;
  if(id==='cellarLatch')return `<path d="M${x+14} ${y+25}h${w-28}l-31 ${h-52}H${x+44}Z" fill="${state.flags.latchClear?'#102b39':'#25323c'}" stroke="#8b857c" stroke-width="11"/>
   <path d="M${x+59} ${y+38}l-15 ${h-73}m89 -${h-74} -8 ${h-50}m82 -${h-50} -10 ${h-48}" stroke="#6f7880" stroke-width="7"/>
   <rect x="${x+w*.67}" y="${y+48}" width="59" height="23" fill="${state.flags.latchClear?'#5e827b':'#896e59'}" stroke="#dbc7a2" stroke-width="5"/>
   ${state.flags.latchClear?glow(x+w*.48,y+h*.6,100):''}${text(x+w/2,y+h-21,state.flags.latchClear?'HATCH UNLATCHED':'SEALED HATCH',14,gold)}`;
  return '';
 };
 DeliveryArt.ambient=scene=>
  `<g class="wv-ghost-fog" opacity=".21" fill="none" stroke="#aab8bf"><path d="M-90 442q220-50 470 0t500-12t480 0" stroke-width="27"/><path d="M-80 485q228 52 472 0t489 10t460-12" stroke-width="13"/></g>`+
  (scene==='home'||scene==='lane'||scene==='well'?`<g class="wv-night-birds" fill="#0b1521"><path d="M245 177q22-24 39 0q22-24 45-7-22 5-45 22-19-14-39-15ZM883 255q18-16 40 0 25-19 41-1-22-1-39 14-21-12-42-13Z"/></g>`:'');
 window.WhisperingVillageArt={
  ride:`<g class="wv-ride-fx"><path d="M0 590h1280" stroke="${gold}" opacity=".36" stroke-width="5" stroke-dasharray="180 155"/><path d="M0 620h1280" stroke="#c9e9ee" opacity=".25" stroke-width="4" stroke-dasharray="120 80"/><path d="M0 650h1280" stroke="#c9e9ee" opacity=".23" stroke-width="4" stroke-dasharray="105 160"/><path d="M698 451l582-163v325Z" fill="url(#wv-headbeam)"/><circle cx="767" cy="496" r="8" fill="${gold}"/>${glow(767,496,155)}</g>`,
  reveal:`<g class="wv-cellar-light">${glow(852,448,244)}</g><path class="wv-hatch-open" d="M739 424h334l-41 117H691Z" stroke="#d2bb8f" stroke-width="12" fill="#13263c"/><g class="wv-rescue-figures">
   <circle cx="857" cy="456" r="31" fill="#c99e82" stroke="#ead6c2" stroke-width="4"/>
   <path d="M812 501q43-33 89 0l17 128H788Z" fill="#5c6580" stroke="#a6b9c9" stroke-width="4"/>
   <circle cx="977" cy="488" r="22" fill="#ceac99" stroke="#e3d4bc" stroke-width="3"/>
   <path d="M947 516q30-23 61 0l18 103h-94Z" fill="#7c5d5c" stroke="#af9999" stroke-width="4"/>
   <path d="M824 628v39m69-39 2 41m63-44 2 33m52-33 5 33" stroke="#667484" stroke-width="16"/>
   </g><g class="wv-rescue-dust">${Array.from({length:24},(_,i)=>`<circle cx="${703+(i*67)%370}" cy="${325+(i*83)%225}" r="${1+i%4}" fill="${i%2?gold:blue}" opacity=".7"/>`).join('')}</g>`
 };
})();
