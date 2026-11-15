/* UMTO Mission 010: original nighttime school / mathematics mystery artwork. */
'use strict';
(function(){
 const ink='#091827',stone='#23364b',rim='#607189',gold='#f7d08b',blue='#8edcf5',pink='#e8a0c8',teal='#78d8b5';
 const rect=(x,y,w,h,fill,stroke='#60758e',rx=9)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`;
 const word=(x,y,s,size=20,c=gold)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${size}" font-weight="750" letter-spacing="1.4" fill="${c}">${s}</text>`;
 const back=()=>`<rect width="1280" height="720" fill="#101b30"/><path d="M0 0H1280V580H0Z" fill="#17243c"/><circle cx="1099" cy="108" r="69" fill="#e4e1ca" opacity=".83"/><circle cx="1070" cy="90" r="68" fill="#17243c" opacity=".18"/>${Array.from({length:46},(_,i)=>`<circle cx="${(i*223+77)%1280}" cy="${(i*137+51)%355}" r="${i%4===0?2:1}" fill="#f0dab6" opacity=".72"/>`).join('')}`;
 const ground=()=>`<path d="M0 532Q292 509 610 533T1280 529V720H0Z" fill="#283646"/><path d="M0 578Q610 546 1280 578" fill="none" stroke="#566274" stroke-width="7" opacity=".55"/><path d="M120 720 336 534M1140 720 944 534M480 720 528 534M805 720 750 534" stroke="#627087" stroke-width="5" opacity=".25"/>`;
 const windowBox=(x,y,w=100,h=145)=>`${rect(x,y,w,h,'#d4aa6c','#354756',3)}<rect x="${x+9}" y="${y+9}" width="${w-18}" height="${h-18}" fill="#69829a" opacity=".78"/><path d="M${x+w/2} ${y+7}v${h-14}M${x+7} ${y+h/2}h${w-14}" stroke="#293746" stroke-width="7"/>`;
 const lamp=(x,y)=>`<path d="M${x} ${y}v-72" stroke="#846e5c" stroke-width="12"/><circle cx="${x}" cy="${y-83}" r="22" fill="#ffe5a4"/><circle cx="${x}" cy="${y-83}" r="66" fill="#e8cc82" opacity=".09"/>`;
 DeliveryArt.courtyard=()=>`${back()}${ground()}<g fill="#101d2c"><path d="M0 504V260L83 177l78 83v244ZM1150 515V248l69-78 61 78v267Z"/></g>
  <path d="M174 493V240L330 153H980l133 87V493Z" fill="#2e4258" stroke="#42566a" stroke-width="12"/>
  <path d="M322 153 411 95H910l75 58Z" fill="#182b3c" stroke="#718095" stroke-width="9"/>
  ${windowBox(221,280,119,159)}${windowBox(935,280,119,159)}
  <path d="M440 500V219H838V500Z" fill="#142b40" stroke="#a6b2a9" stroke-width="14"/>
  <path d="M639 219v282" stroke="#afaf9a" stroke-width="13"/>
  <path d="M461 275H618M661 275H811M461 345H618M661 345H811M461 416H618M661 416H811" stroke="#3c7797" stroke-width="8" opacity=".55"/>
  <path d="M523 216v-60a116 116 0 01232 0v60" fill="#31465c" stroke="#dbbd80" stroke-width="10"/>
  ${word(636,174,'THE OLD SCHOOL',26)}
  <g transform="translate(164 383) rotate(-6)">${rect(-82,-76,164,142,'#25384a','#c8a97a')}${word(0,-40,'3,472',26,pink)}${word(0,-6,'ROUND TO',16)}${word(0,27,'100',25)}</g>
  ${lamp(376,521)}${lamp(905,520)}
  <path d="M0 520Q120 490 220 518" fill="none" stroke="#6d7084" stroke-width="14" opacity=".32"/>
  ${word(642,96,'THE CLOCK HAS AWAKENED',19,blue)}
  <rect width="1280" height="720" fill="url(#d-grain)"/>`;
 DeliveryArt.hallway=()=>`<rect width="1280" height="720" fill="#15253b"/>
  <path d="M0 0H1280V511H0Z" fill="#25354a"/><path d="M0 0 220 120h842L1280 0Z" fill="#1a293e"/><path d="M0 513H1280V720H0Z" fill="#314056"/>
  ${Array.from({length:5},(_,i)=>`<path d="M${i*280} 510 ${(i-2)*120+605} 720" stroke="#607087" opacity=".35" stroke-width="5"/>`).join('')}
  <path d="M0 577H1280M0 648H1280" stroke="#63758b" opacity=".3" stroke-width="5"/>
  ${windowBox(46,127,120,197)}${windowBox(1123,115,119,203)}
  <rect x="154" y="177" width="455" height="208" rx="12" fill="#18293a" stroke="#d6ba83" stroke-width="11"/>
  ${word(379,219,'THE VANISHING SEQUENCE',18,blue)}
  ${[12,18,24,30,'?'].map((n,i)=>`${rect(184+i*78,259,64,70,'#2d4560',i===4?pink:'#8ca9ba')}${word(216+i*78,308,String(n),24,i===4?pink:gold)}`).join('')}
  <path d="M790 217h345v295H790Z" fill="#15283b" stroke="#bdad8a" stroke-width="15"/>
  <path d="M963 220v294" stroke="#829aa2" stroke-width="9"/><circle cx="1051" cy="371" r="15" fill="#e1c185"/>
  <path d="M428 567H955L1110 687H252Z" fill="#1a394d" stroke="#8ba7ac" stroke-width="9"/>
  ${Array.from({length:7},(_,r)=>Array.from({length:8},(_,c)=>`<rect x="${391+c*61+r*8}" y="${544+r*14}" width="42" height="18" rx="3" fill="${(r+c)%2?'#f4cf84':'#8ad9d4'}" opacity=".85"/>`).join('')).join('')}
  ${word(670,94,'THE NUMBER CORRIDOR',24)}
  <rect width="1280" height="720" fill="url(#d-grain)"/>`;
 DeliveryArt.classroom=()=>`<rect width="1280" height="720" fill="#23354a"/>
  <path d="M0 0H1280V511H0Z" fill="#2b4255"/><path d="M0 514H1280V720H0Z" fill="#3c4050"/>
  <path d="M0 587H1280M0 666H1280M287 515l-97 205M680 514l24 206M1051 518l145 202" stroke="#7b7378" stroke-width="6" opacity=".35"/>
  ${windowBox(50,122,190,259)}
  <path d="M45 416H893V473H45Z" fill="#765348" stroke="#a27a61" stroke-width="8"/>
  ${Array.from({length:12},(_,i)=>`<g transform="translate(${83+(i%6)*43} ${179+Math.floor(i/6)*94})"><path d="M0 0v35" stroke="#e0bc81" stroke-width="6"/><rect x="-12" y="32" width="24" height="36" rx="4" fill="#b9d8c6" stroke="#1d3144" stroke-width="4"/></g>`).join('')}
  <path d="M458 152H803V414H458Z" fill="#e3d4b5" stroke="#735948" stroke-width="14"/>
  <path d="M511 326H752V201H511Z" fill="#b4bec3" stroke="#6e858e" stroke-width="7"/>
  ${word(628,243,'7 m',28,ink)}${word(479,274,'5',21,ink)}${word(479,301,'m',19,ink)}${word(636,373,'FIND PERIMETER',16,ink)}
  <path d="M1016 525V164L1109 100l101 64v361Z" fill="#1e2e3e" stroke="#cca873" stroke-width="14"/>
  <path d="M1074 524V208h80v316Z" fill="#36556a" stroke="#83acbb" stroke-width="7"/>
  <circle cx="1142" cy="352" r="12" fill="#f3d49c"/>
  ${word(645,85,'THE MATHEMATICS LAB',27)}
  <rect width="1280" height="720" fill="url(#d-grain)"/>`;
 DeliveryArt.vault=()=>`${back()}${ground()}
  <path d="M80 524V142L220 74h840l140 68v382Z" fill="#213348" stroke="#667c94" stroke-width="12"/>
  <path d="M210 143H1070M210 143V525M1070 143V525M430 146V510M844 146V510" stroke="#5f7285" stroke-width="16"/>
  <path d="M510 140V76H760V140" fill="#1e2b3c" stroke="#e9cd95" stroke-width="8"/>
  <circle cx="638" cy="184" r="109" fill="#c5ad7d" stroke="#35495c" stroke-width="14"/><circle cx="638" cy="184" r="90" fill="#e6cf9e" stroke="#293947" stroke-width="5"/>
  ${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return `<circle cx="${638+76*Math.sin(a)}" cy="${184-76*Math.cos(a)}" r="4" fill="#33495e"/>`}).join('')}
  <path d="M638 112V184l39 26" stroke="#263c50" stroke-width="8" stroke-linecap="round" fill="none"/>
  <path d="M850 494V258h277v236Z" fill="#334c61" stroke="#e8c88f" stroke-width="15"/>
  <rect x="911" y="324" width="168" height="122" rx="12" fill="#866146" stroke="#e3c27f" stroke-width="11"/>
  ${word(996,368,'TIME',21,'#fff5d3')}${word(995,405,'CAPSULE',21,'#fff5d3')}
  ${lamp(280,512)}${lamp(1160,512)}
  ${word(628,42,'THE MIDNIGHT VAULT',25)}
  <rect width="1280" height="720" fill="url(#d-grain)"/>`;
 const nav={back:'← BACK TO CLUES',door:'ENTER THE LAB →',gate:'ROUND & UNLOCK →',vaultDoor:'OPEN THE VAULT →'};
 const people={kabir:'TALK TO KABIR',meher:'TALK TO MEHER',rohan:'TALK TO ROHAN',meena:'TALK TO MEENA',baldev:'TALK TO BALDEV'};
 const puzzles={pattern:'NUMBER PATTERN',tiles:'MULTIPLY 7 × 8',lanterns:'FRACTION SWITCHES',blueprint:'PERIMETER',capsule:'OPEN CAPSULE',clock:'INSPECT CLOCK',note:'READ CHALK'};
 DeliveryArt.prop=(o,S)=>{
  const {id,x,y,w,h}=o,cx=x+w/2;
  const done={gate:S.flags.rounded,pattern:S.flags.patternDone,tiles:S.flags.arrayDone,lanterns:S.flags.fractionsDone,blueprint:S.flags.perimeterDone}[id];
  if(nav[id])return rect(x,y+h-52,w,52,id==='gate'&&done?'#225d52':'#14263a',gold)+word(cx,y+h-18,nav[id],17);
  if(people[id])return rect(x+2,y,w-4,34,'#172b40',blue)+word(cx,y+24,people[id],14,blue);
  if(puzzles[id]){
   const title=done?'✓ SOLVED':puzzles[id];
   return rect(x,y+h-42,w,42,done?'#246454':'#132c40',done?teal:gold)+word(cx,y+h-14,title,17,done?'#e1ffed':gold);
  }
  return rect(x,y+h-42,w,42,'#1b334a',gold)+word(cx,y+h-16,(o.name||'EXPLORE').slice(0,24).toUpperCase(),15);
 };
 window.MathVaultArt={reveal:`<g><circle cx="997" cy="382" r="245" fill="#fbd68e" opacity=".14"/><circle cx="996" cy="382" r="154" fill="#fbd68e" opacity=".18"/>${Array.from({length:38},(_,i)=>`<circle cx="${(i*119+112)%1260}" cy="${(i*83+44)%540}" r="${3+i%5}" fill="${i%2?blue:gold}" opacity=".9"/>`).join('')}${word(970,268,'CASE CLOSED!',36,'#fff3cf')}${word(963,320,'FIVE MATH LOCKS OPEN',19,blue)}</g>`};
})();
