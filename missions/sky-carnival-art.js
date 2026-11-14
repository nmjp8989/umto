'use strict';
/* Mission 009 original hand-authored daytime SVG scene pack. No remote images. */
(function(){
 const navy='#233550',cream='#fff9e8',sun='#ffd26e',coral='#f16e70',aqua='#60c7c4',violet='#8d7ae0';
 const text=(x,y,s,size=19,color=navy)=>`<text x="${x}" y="${y}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="850" text-anchor="middle" fill="${color}">${s}</text>`;
 const box=(x,y,w,h,fill=navy)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${cream}" stroke-width="4"/>`;
 const cloud=(x,y,k=1)=>`<g transform="translate(${x} ${y}) scale(${k})" fill="#fff" opacity=".89"><ellipse cx="-44" cy="18" rx="76" ry="29"/><ellipse cx="8" cy="-7" rx="61" ry="43"/><ellipse cx="66" cy="13" rx="66" ry="34"/></g>`;
 const sky=()=>`<rect width="1280" height="720" fill="#94d8f5"/><path d="M0 0H1280V340Q920 310 680 392T0 330Z" fill="#bdeaf9"/><circle cx="1110" cy="103" r="70" fill="#ffe9a2"/>${cloud(185,122,1)}${cloud(754,92,.65)}${cloud(1095,289,.49)}`;
 const meadow=()=>`<path d="M0 526Q197 430 362 506T670 489T958 492T1280 444V720H0Z" fill="#78be87"/><path d="M0 596Q259 509 520 571T1004 530T1280 568V720H0Z" fill="#49a998"/><path d="M0 632H1280V720H0Z" fill="#e9c681"/>`;
 const banner=()=>`<path d="M0 72Q630 181 1280 70" fill="none" stroke="#556b82" stroke-width="5"/>${Array.from({length:17},(_,i)=>`<path d="M${i*82} ${78+Math.sin(i/16*Math.PI)*64}l45 10-23 56Z" fill="${['#f47275','#ffe075','#73ccca','#bba3f1'][i%4]}"/>`).join('')}`;
 const cake=(x,y,k=1)=>`<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="54" rx="64" ry="15" fill="#4b7890" opacity=".2"/><path d="M-60 7H60V49Q0 76-60 49Z" fill="#fa92af" stroke="#9a6387" stroke-width="5"/><path d="M-62 8Q-52-22 0-14T62 8Q46 32 28 11Q5 30-13 14Q-35 34-62 8" fill="#fff5e7" stroke="#a97c9f" stroke-width="4"/><circle cx="-35" cy="-21" r="9" fill="#ffdd6b"/><circle cx="4" cy="-24" r="9" fill="#78d5d3"/><circle cx="37" cy="-19" r="9" fill="#ffdd6b"/><path d="M0-29V-59" stroke="#594067" stroke-width="5"/><path d="M0-66q16 16 0 25q-16-9 0-25Z" fill="#ffca45"/></g>`;
 const balloon=(x,y,k=1)=>`<g class="sky-balloon" transform="translate(${x} ${y}) scale(${k})"><ellipse cy="-56" rx="89" ry="124" fill="#ff7d82" stroke="#a34d69" stroke-width="6"/><path d="M0-179q-86 45-72 130T0 56Q-29-28 0-179Z" fill="#ffcb6c"/><path d="M0-179q86 45 72 130T0 56Q29-28 0-179Z" fill="#86d6d1"/><path d="M-58 23-33 99M58 23 33 99" stroke="#805a53" stroke-width="5"/><path d="M-48 97H48L37 154H-37Z" fill="#ad7756" stroke="#634b50" stroke-width="5"/>${cake(0,112,.42)}<path d="M-48 113H48M-43 126H43" stroke="#eac49a" stroke-width="4" fill="none"/></g>`;
 DeliveryArt.fairground=()=>sky()+meadow()+banner()+`
   <g transform="translate(170 434)"><circle cx="0" cy="-82" r="132" fill="none" stroke="#b26ca6" stroke-width="15"/><circle cx="0" cy="-82" r="17" fill="#ffe594"/>${Array.from({length:8},(_,i)=>{let a=i*Math.PI/4,x=Math.round(112*Math.cos(a)),y=Math.round(-82+112*Math.sin(a));return `<path d="M0-82L${x} ${y}" stroke="#c5a2cd" stroke-width="7"/><rect x="${x-21}" y="${y+4}" width="42" height="34" rx="8" fill="${i%2?coral:aqua}" stroke="#fff5da" stroke-width="4"/>`}).join('')}<path d="M-84 148 0-82 86 148" fill="none" stroke="#55617b" stroke-width="12"/></g>
   <g transform="translate(925 430)"><path d="M-115 115V-13L-85-68H65L114-13V115Z" fill="#f8e9bb" stroke="#835768" stroke-width="7"/><path d="M-116-4-88-68H67L112-4Z" fill="#f7747c"/><rect x="-82" y="24" width="160" height="96" fill="#78ccc4"/>${text(0,5,'SKY CARNIVAL',22)}<path d="M-110 75H110" stroke="#fff2d7" stroke-width="9"/></g>
   ${balloon(695,243,.66)}
   <path d="M0 624Q300 586 570 637T1280 612" fill="none" stroke="#fae6ad" stroke-width="10"/>
   ${Array.from({length:12},(_,i)=>`<circle cx="${57+i*105}" cy="${595+(i%3)*14}" r="5" fill="${i%2?'#f48691':'#f7eaa1'}"/>`).join('')}
  `;
 DeliveryArt.workshop=()=>`<rect width="1280" height="720" fill="#ffdfaa"/><rect y="0" width="1280" height="485" fill="#ffe9ba"/><path d="M0 132 166 55 359 140 560 58 749 136 938 60 1280 126" fill="none" stroke="#d4a979" stroke-width="12"/>
  <rect y="495" width="1280" height="225" fill="#cd9f72"/><path d="M0 576H1280M0 650H1280" stroke="#b9815b" stroke-width="6"/>
  <path d="M55 98H491V424H55Z" fill="#83d2ca" stroke="#ad796d" stroke-width="14"/><path d="M273 98V424M55 262H491" stroke="#fff7d4" stroke-width="9"/>
  <path d="M762 105H1131V410H762Z" fill="#fff6d5" stroke="#b1806c" stroke-width="14"/><path d="M812 201H1080M812 275H1080" stroke="#be8a72" stroke-width="11"/>
  <rect x="104" y="442" width="1094" height="93" rx="11" fill="#8e6476" stroke="#4e4b64" stroke-width="9"/>
  <g transform="translate(555 390)"><circle r="76" fill="#f5b858" stroke="#6f6170" stroke-width="9"/><path d="M-13-10Q-132-140-48-162T10-20Q148-141 153-55T20 7Q126 149 40 160T1 25Q-148 123-155 43T-22-3Z" fill="#82c8bf" stroke="#4e6277" stroke-width="7"/><circle r="18" fill="#f9f1ce"/></g>
  <path d="M840 460q-40-112 45-129q84-12 85 94" fill="none" stroke="#da7275" stroke-width="18"/>
  <path d="M1120 421q-78-90-9-155q44 34 70 103Z" fill="#ff7f8f" stroke="#fff3d6" stroke-width="8"/>${text(914,76,'THE INVENTION TENT',40)}
  `;
 DeliveryArt.launchpad=()=>sky()+meadow()+`<path d="M0 568H1280V720H0Z" fill="#ebc492"/><path d="M94 558Q540 488 1166 562" fill="none" stroke="#fff4d5" stroke-width="9"/>
  <g transform="translate(260 410)"><rect x="-100" y="0" width="210" height="150" rx="22" fill="#638baa" stroke="#3d5877" stroke-width="8"/><circle cy="40" r="70" fill="#e9f2d4" stroke="#415a72" stroke-width="11"/><g class="fan-turn" fill="#f29b72"><ellipse cy="-28" rx="22" ry="48"/><ellipse cy="-28" rx="22" ry="48" transform="rotate(120)"/><ellipse cy="-28" rx="22" ry="48" transform="rotate(240)"/></g><circle cy="40" r="12" fill="#4e5d81"/></g>
  ${balloon(885,316,1.08)}
  <path d="M785 520Q758 562 718 584" fill="none" stroke="#e9ca82" stroke-width="6" stroke-dasharray="12 9"/>
  <g transform="translate(485 326)"><path d="M-7 168V-75" stroke="#805d68" stroke-width="13"/><path d="M0-75 111-49 0-13Z" fill="#f58186"/><path d="M0 17-120 48 0 76Z" fill="#7fd2c9"/><circle cy="-2" r="20" fill="#fff3ca" stroke="#745b61" stroke-width="6"/></g>
  ${text(621,616,'THE LAUNCH FIELD',26)}
  `;
 DeliveryArt.skydeck=()=>sky()+`<path d="M0 570Q330 486 610 526T1280 490V720H0Z" fill="#8bc6dd" opacity=".36"/>${cloud(300,365,1.3)}${cloud(1020,444,1.1)}${balloon(1002,295,.81)}
  <path d="M0 570 1280 570 1280 720H0Z" fill="#b47657" stroke="#694e62" stroke-width="14"/><path d="M0 606H1280M0 652H1280" stroke="#f7d8a3" stroke-width="7"/>
  <path d="M0 560H1280" stroke="#edf5ed" stroke-width="14"/>${Array.from({length:13},(_,i)=>`<path d="M${i*105} 559V665" stroke="#eee2be" stroke-width="8"/>`).join('')}
  <path d="M1120 520Q1008 454 928 501" fill="none" stroke="#e9d2a1" stroke-width="10"/>
  ${text(655,71,'HIGH ABOVE THE CARNIVAL!',29)}
  `;
 const buttons={goWorkshop:'REPAIR TENT →',goPad:'LAUNCH FIELD →',back:'← BACK',pad:'LAUNCH FIELD →',fair:'← CARNIVAL',board:'CLIMB ABOARD →',land:'SAVE THE PARTY →'};
 const persons={kabir:'TALK TO KABIR',meher:'TALK TO MEHER',rohan:'TALK TO ROHAN',meena:'TALK TO MEENA',baldev:'TALK TO BALDEV'};
 DeliveryArt.prop=(o,state)=>{
  const {id,x,y,w,h}=o,cx=x+w/2,cy=y+h/2,flags=state.flags||{};
  if(buttons[id])return box(x,y+h-56,w,56,id==='land'?coral:navy)+text(cx,y+h-20,buttons[id],18,cream);
  if(persons[id])return box(x+2,y,w-4,36,violet)+text(cx,y+25,persons[id],16,cream);
  if(id==='balloon')return flags.patched&&flags.tethered?box(x,y+h-36,w,38,aqua)+text(cx,y+h-11,'READY TO FLY!',16):box(x,y+h-36,w,38,coral)+text(cx,y+h-11,'RESCUE BALLOON',16,cream);
  if(id==='banner')return box(x,y+h-39,w,39,coral)+text(cx,y+h-12,'READ THE POSTER',16,cream);
  if(id==='cake')return box(x,y+h-39,w,39,coral)+text(cx,y+h-12,'CATCH THE CAKE!',17,cream);
  if(id==='fan')return box(x,y+h-40,w,40,aqua)+text(cx,y+h-12,'TUNE THE FAN',17);
  if(id==='fabric')return `<path d="M${x+18} ${y+18}l${w-39} -8 14 ${h-48} -${w-25} 9Z" fill="#ff7798" stroke="#fff1d8" stroke-width="7"/>`+text(cx,y+h-10,'PATCH FABRIC',16);
  if(id==='rope')return `<ellipse cx="${cx}" cy="${cy}" rx="${w*.34}" ry="${h*.29}" fill="none" stroke="#ebbf77" stroke-width="15"/><ellipse cx="${cx}" cy="${cy}" rx="${w*.2}" ry="${h*.15}" fill="none" stroke="#e6ba75" stroke-width="9"/>`+text(cx,y+h-9,'SAFETY ROPE',16);
  if(id==='windvane')return box(x,y+h-36,w,36,navy)+text(cx,y+h-12,'CHOOSE THE WIND',16,cream);
  if(id==='net')return box(x,y+h-36,w,36,aqua)+text(cx,y+h-11,'RESCUE NET',16);
  if(id==='cloud')return box(x,y+h-34,w,34,navy)+text(cx,y+h-12,'LOOK AT CLOUDS',15,cream);
  return box(x,y+h-38,w,38,navy)+text(cx,y+h-12,(o.name||'EXPLORE').slice(0,22).toUpperCase(),15,cream);
 };
 DeliveryArt.icons.fabric=`<path d="M10 16 72 6 80 70 18 82Z" fill="#fb7fa1" stroke="#884e79" stroke-width="6"/><path d="M12 28 69 19" stroke="#ffecce" stroke-width="5" stroke-dasharray="10 9"/>`;
 DeliveryArt.icons.rope=`<ellipse cx="45" cy="43" rx="31" ry="28" fill="none" stroke="#dbb66c" stroke-width="13"/><ellipse cx="45" cy="43" rx="17" ry="14" fill="none" stroke="#f3d18e" stroke-width="9"/>`;
 window.SkyCarnivalArt={reveal:`<g class="sky-confetti">${Array.from({length:75},(_,i)=>`<rect x="${(i*181)%1280}" y="${(i*97)%515}" width="13" height="9" rx="2" fill="${[coral,sun,aqua,violet][i%4]}" transform="rotate(${i*27%70} ${(i*181)%1280} ${(i*97)%515})"/>`).join('')}</g>${cake(627,410,1.3)}${text(626,292,'CAKE SAVED!',48,'#fff7df')}`};
})();
