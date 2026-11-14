'use strict';
(function(){
 const ink='#101d2e', gold='#ffdc9d', pink='#f38fb8', sky='#b4dce8';
 const box=(x,y,w,h,fill,stroke='#738e99')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
 const label=(x,y,value,colour=gold)=>`<text x="${x}" y="${y}" fill="${colour}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="750" font-size="17" letter-spacing="1">${value}</text>`;
 const star='0,-42 12,-14 40,-13 19,7 27,37 0,21 -27,37 -19,7 -40,-13 -12,-14';
 const signalRoom=DeliveryArt.platform;
 const courtyard=DeliveryArt.yard;
 DeliveryArt.platform=()=>signalRoom()+`<path d="M1010 330 Q675 282 378 384" fill="none" stroke="${pink}" stroke-width="4" opacity=".55"/>`;
 DeliveryArt.yard=()=>courtyard()+`
  <path d="M84 214 Q623 348 1153 174" fill="none" stroke="#94a1af" stroke-width="3"/>
  ${['#e7a370','#b5cf86','#df96bb','#78b8d4','#f1c57c','#c6a9db'].map((colour,i)=>`<path d="M${139+i*177} ${228+(i<3?i*20:(5-i)*21)}l34 5-14 28Z" fill="${colour}"/>`).join('')}
  <path d="M210 324q403-101 720-15t333-14" fill="none" stroke="${pink}" stroke-width="4" opacity=".73"/>
  <path d="M1070 218v-96h95v96m-107-96 60-63 62 63Z" fill="#23364a" stroke="#658196" stroke-width="5"/>
  <circle cx="1118" cy="152" r="18" fill="${gold}"/><path d="M1118 142v10l8 4" fill="none" stroke="${ink}" stroke-width="3"/>`;
 DeliveryArt.clocktower=()=>`
  <rect width="1280" height="720" fill="url(#wvp-night)"/>
  <circle cx="1100" cy="140" r="58" fill="#d3e4e9" opacity=".7"/>
  <path d="M0 486V155L159 81h951l170 74v331Z" fill="#182e41"/>
  <path d="M0 164l160-82h948l172 82M0 396h1280M138 91v449m994-449v449M310 113v429m487-429v429" fill="none" stroke="#415267" stroke-width="22"/>
  <path d="M0 536h1280v184H0Z" fill="url(#wvp-floor)"/>
  <path d="M0 545h1280m-1280 56h1280m-1280 62h1280" fill="none" stroke="#657582" opacity=".28" stroke-width="4"/>
  <circle cx="699" cy="191" r="132" fill="url(#wvp-glow)"/>
  <circle cx="699" cy="166" r="65" fill="#e2ca8a" stroke="#9b7f54" stroke-width="9"/>
  <path d="M699 121v45l29 18" stroke="${ink}" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M770 97l55 40-46 39-53-34Z" fill="#7a9aab" stroke="${sky}" stroke-width="4"/>
  <path class="kite-tail" d="M778 176q20 47-64 45T581 263q-42 42-128 22" fill="none" stroke="${pink}" stroke-width="7" stroke-linecap="round"/>
  <path d="M684 336Q508 355 282 532H121" fill="none" stroke="#466274" stroke-width="16" opacity=".6"/>`;
 const paths={cross:'KITE COURTYARD →',back:'← GO BACK',cabin:'CLOCK TOWER →',solve:'SOLVE THE CASE'};
 const people={baldev:'TALK TO BALDEV',meher:'TALK TO MEHER',rohan:'TALK TO ROHAN'};
 DeliveryArt.prop=(o,state)=>{
  const {id,x,y,w,h}=o,cx=x+w/2;
  if(paths[id])return box(x,y+h-49,w,49,id==='solve'?'#594327':ink)+label(cx,y+h-19,paths[id]);
  if(people[id])return box(x+3,y,w-6,32,ink)+label(cx,y+23,people[id],sky);
  if(id==='print')return box(x,y,w,h,'#203848')+`<circle cx="${cx}" cy="${y+62}" r="49" fill="#8b4762"/><polygon points="${star}" transform="translate(${cx} ${y+61}) scale(.75)" fill="#feabc7"/>`+label(cx,y+140,'WAX MARK');
  if(id==='bell')return `<path d="M${cx-55} ${y+113}q22-19 23-61a32 32 0 0164 0q1 42 23 61Z" fill="#d1a45e" stroke="${gold}" stroke-width="5"/><circle cx="${cx}" cy="${y+117}" r="9" fill="${gold}"/>`+label(cx,y+146,'DUSTY BELL');
  if(id==='reel')return `<circle cx="${cx}" cy="${y+63}" r="49" fill="#332c42" stroke="${pink}" stroke-width="5"/><polygon points="${star}" transform="translate(${cx} ${y+62})" fill="${gold}"/><circle cx="${cx}" cy="${y+62}" r="10" fill="#8d6551"/>`+label(cx,y+137,'KITE REEL');
  if(id==='crate'){
   const found=state.flags.registerFound;
   return box(x+20,y+54,w-40,107,'#255a75',sky)
    +`<ellipse cx="${cx}" cy="${y+52}" rx="${w/2-20}" ry="23" fill="#4085a4" stroke="${sky}" stroke-width="4"/>`
    + (found?box(x+64,y+5,w-128,67,'#874c48',gold)+label(cx,y+45,'REGISTER'):`<path d="M${cx+25} ${y+46}l24-12 6 17Z" fill="${gold}"/>`)
    +label(cx,y+121,'BLUE DRUM');
  }
  return '';
 };
})();
