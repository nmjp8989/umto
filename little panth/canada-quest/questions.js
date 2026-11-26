'use strict';

const regions = [
  ['BC','British Columbia','Victoria','over 5 million','Capilano Suspension Bridge, Whistler Blackcomb','Haida, Coast Salish and Kwakwaka’wakw','Pacific coast, mountains and forests','forestry, fishing, tourism and film production'],
  ['AB','Alberta','Edmonton','over 4.5 million','Banff, Jasper, Calgary Stampede and West Edmonton Mall','Treaties 6, 7 and 8','Rocky Mountains, foothills and forests','oil and gas, agriculture including wheat and canola'],
  ['SK','Saskatchewan','Regina','over 1.2 million','Grasslands National Park, Wanuskewin Heritage Park and Prince Albert National Park','Treaties 2, 4, 5, 6 and 10','prairies, rolling hills and lakes','agriculture, mining, oil and gas, and manufacturing'],
  ['MB','Manitoba','Winnipeg','over 1.4 million','The Forks, Assiniboine Park, Canadian Museum for Human Rights and Riding Mountain National Park','Treaties 1, 2, 4, 5 and 6','prairies, lakes and rivers','agriculture, mining and manufacturing'],
  ['ON','Ontario','Toronto','over 15 million','CN Tower, Niagara Falls and Parliament Hill','Anishinaabe, Haudenosaunee and many others','Great Lakes, including lakes Ontario, Huron and Erie','manufacturing, services, agriculture and mining'],
  ['QC','Québec','Québec City','over 8.7 million','Mont-Tremblant, St. Lawrence River and Château Frontenac','Innu, Atikamekw and many others','St. Lawrence River, mountains and forests','manufacturing, hydroelectric power, agriculture, maple syrup and tourism'],
  ['NB','New Brunswick','Fredericton','over 800,000','Hopewell Rocks, Fundy National Park, Reversing Falls and Bay of Fundy','Wolastoqiyik (Maliseet) and Mi’kmaq','Atlantic coast, forests, rivers and very high tides','services, construction, forestry, fishing, agriculture and tourism'],
  ['NS','Nova Scotia','Halifax','over 950,000','Peggy’s Cove Lighthouse, Bay of Fundy and Cabot Trail','Mi’kmaq','Atlantic coast, fishing villages and rocky shores','fishing, forestry, agriculture and tourism'],
  ['PE','Prince Edward Island','Charlottetown','over 170,000','Green Gables Heritage Place, Confederation Bridge and Cavendish Beach','Mi’kmaq','red-sand beaches, farmland and rural communities','agriculture, especially potato farming, and seafood'],
  ['NL','Newfoundland and Labrador','St. John’s','over 500,000','Gros Morne, Signal Hill, Cape Spear and L’Anse aux Meadows','Innu, Inuit, Mi’kmaq and many others','rugged coasts, fjords and Atlantic puffins','fishing, mining, oil production and tourism'],
  ['YT','Yukon','Whitehorse','over 44,000','Kluane National Park and Reserve, Miles Canyon and SS Klondike','Kwanlin Dün, Ta’an Kwäch’än and many others','mountains and wilderness in the far northwest','mining, tourism and outdoor recreation'],
  ['NT','Northwest Territories','Yellowknife','over 45,000','Nahanni National Park Reserve and Great Bear Lake','Dene, Inuvialuit and many others','lakes, boreal forests and tundra','mining, oil and gas, and tourism'],
  ['NU','Nunavut','Iqaluit','over 40,000','Auyuittuq National Park, Sirmilik National Park and Rankin Inlet','Inuit','Arctic islands, icy landscapes, tundra and mountains','mining, fishing, hunting, and arts and crafts']
];

const regionsById = Object.fromEntries(regions.map(region => [region[0],region]));
const chapters = [
  ['map','Political map','Locate and label all 13 regions','◎'],
  ['compass','Compass trails','Use all eight compass directions','✥'],
  ['spell','Capital & spelling lab','Type every province, territory and capital','Aa'],
  ['regions','Regional field notes','Landmarks, industries, landscapes and peoples','✦'],
  ['concepts','The why behind Canada','Definitions and cause-and-effect challenges','?'],
  ['workshop','Map & sketch studio','Colour, draw and explain your ideas','✎']
];
const questions = [];
function add(chapter, id, type, prompt, data) {
  questions.push({chapter, id, type, prompt, ...data});
}
function choose(chapter,id,prompt,answer,wrong,note) {
  add(chapter,id,'choice',prompt,{answer,wrong,note});
}
function spell(id,prompt,answer,note,group='spell',spoken) {
  add(group,id,'text',prompt,{answer,note,spoken});
}

regions.forEach(([code,name,capital,population,landmarks,peoples,land,industry], i) => {
  const neighbours = [3,7,10].map(offset => regions[(i+offset)%regions.length]);
  add('map','locate-'+code,'map',`Tap ${name} on the map.`,{answer:code,note:`That region is ${name}. Its capital is ${capital}.`});
  spell('label-'+code,'Type the full name of the highlighted region.',name,`${capital} is its capital.`,'map');
  questions.at(-1).region=code;
  add('map','label-city-'+code,'city-map',`Which map pin marks ${capital}?`, {
    answer:code, pins:[code,...neighbours.map(region=>region[0])], note:`${capital} is the capital of ${name}.`
  });
  spell('capital-'+code,`Type the capital of ${name}.`,capital,`${capital} is the capital of ${name}.`);
  spell('region-'+code,`Which province or territory has ${capital} as its capital? Type its full name.`,name,`${name} is the region to remember.`);
  choose('regions','land-'+code,`Which landscape best fits ${name}?`,land,neighbours.map(region=>region[6]),`Look for ${land} in ${name}.`);
  choose('regions','industry-'+code,`Which group of industries matches the ${name} worksheet?`,industry,neighbours.map(region=>region[7]),`The worksheet highlights ${industry}.`);
  choose('regions','landmarks-'+code,`Which group of landmarks is in ${name}?`,landmarks,neighbours.map(region=>region[4]),`The worksheet lists ${landmarks}.`);
  if (code !== 'BC') {
    choose('regions','people-'+code,`Which Indigenous peoples or treaty areas does the ${name} sheet name?`,peoples,
      regions.filter((region,index)=>region[5]!==peoples&&[4,7,10,12].includes((index-i+13)%13))
        .map(region=>region[5]).filter((value,index,list)=>list.indexOf(value)===index).slice(0,3),
      `The worksheet names ${peoples}. These examples are part of a wider Indigenous history.`);
  } else {
    choose('regions','people-BC','Which groups does the British Columbia sheet name?',peoples,
      [regions[4][5],regions[8][5],regions[12][5]],`The worksheet names ${peoples}, among others.`);
  }
  choose('regions','population-'+code,`What rounded population figure is printed on the ${name} sheet?`,population,
    neighbours.map(region=>region[3]),`The worksheet’s figure is ${population}. Population changes over time.`);
});

spell('national-capital','What is the capital city of Canada? Type its name.','Ottawa','Ottawa is Canada’s capital. Toronto is Ontario’s capital.');
add('map','ottawa-map','city-map','Which map pin marks Ottawa, Canada’s capital?',{answer:'CA',pins:['CA','ON','QC','NB'],note:'Ottawa is in Ontario along the Ottawa River, close to the Québec border.'});
choose('map','region-total','How many provinces and territories does Canada have?','10 provinces and 3 territories',['9 provinces and 4 territories','13 provinces and 0 territories','10 territories and 3 provinces'],'There are 13 regions altogether.');
choose('map','all-territories','Which three are territories?','Yukon, Northwest Territories and Nunavut',['Alberta, Saskatchewan and Manitoba','Yukon, Manitoba and Nunavut','Nunavut, Québec and Northwest Territories'],'Find all three territories across northern Canada.');
choose('map','map-key','On your worksheet map, why is blue kept for the water?','It helps the reader tell water from land.',['Every province is blue on a political map.','Blue means a capital city.','Blue shows national borders.'],'Use different non-blue colours for land and keep water blue.');

const bearings = [
  ['NW','northwest'],['N','north'],['NE','northeast'],['W','west'],['E','east'],['SW','southwest'],['S','south'],['SE','southeast']
];
for (const [code,word] of bearings) {
  add('compass','rose-'+code,'compass',`Tap ${word} on the blank compass rose.`,{answer:code,note:`${code} stands for ${word}.`});
}
choose('compass','cardinal','Which are the four cardinal directions?','North, east, south, west',['Northeast, southeast, southwest, northwest','North, southeast, west, northeast','Left, right, up, down'],'Directions halfway between them are called intermediate directions.');
choose('compass','intermediate','Which are the four intermediate directions?','NW, NE, SW and SE',['N, E, S and W','N, W, SW and SE','N, S, NE and SW'],'For example, northeast is halfway between north and east.');
for (const [id,prompt,answer,wrong,note] of [
  ['west-on','Which province is directly west of Ontario?','Manitoba',['Saskatchewan','Québec','Alberta'],'Manitoba shares Ontario’s western border.'],
  ['bc-mb','Which general direction takes you from British Columbia to Manitoba?','East',['West','South','North'],'You move east across Alberta and Saskatchewan.'],
  ['far-north','Which territory reaches farthest north?','Nunavut',['Yukon','Northwest Territories','Ontario'],'Nunavut includes Ellesmere Island in the far north.'],
  ['centre','Which Prairie provinces are near the middle of Canada on the worksheet map?','Saskatchewan and Manitoba',['Yukon and Nunavut','Nova Scotia and Prince Edward Island','Ontario and New Brunswick'],'Look for them between Alberta and Ontario.'],
  ['far-west','What is Canada’s westernmost province?','British Columbia',['Alberta','Yukon','Manitoba'],'Yukon is a territory. British Columbia is the province on the Pacific coast.'],
  ['islands','Which territory has the most islands?','Nunavut',['Yukon','Northwest Territories','Ontario'],'Much of the Canadian Arctic Archipelago is in Nunavut.'],
  ['south-can','Which country is directly south of much of Canada?','United States',['Greenland','Iceland','Mexico'],'Canada and the United States share a long land border.'],
  ['pacific','Which province touches the Pacific Ocean?','British Columbia',['Nova Scotia','Alberta','New Brunswick'],'British Columbia is on Canada’s west coast.'],
  ['atlantic','Which four are Canada’s Atlantic provinces?','New Brunswick, Nova Scotia, Prince Edward Island and Newfoundland and Labrador',['Québec, Ontario, Manitoba and Saskatchewan','British Columbia, Alberta, Manitoba and Ontario','New Brunswick, Nova Scotia, Ontario and Québec'],'Remember the three Maritime provinces plus Newfoundland and Labrador. Québec also has an Atlantic-connected coast.'],
  ['north-on','Which statement uses north correctly?','Nunavut is north of Ontario.',['Nova Scotia is north of Nunavut.','Ontario is north of Nunavut.','The United States is north of Ontario.'],'On the map, Nunavut is above Ontario.'],
  ['south-qc','Which statement uses south correctly?','New Brunswick is southeast of much of Québec.',['Nunavut is south of Ontario.','Yukon is south of British Columbia.','Québec is south of Nova Scotia.'],'New Brunswick is south and east of much of Québec.']
]) choose('compass',id,prompt,answer,wrong,note);
for (const [code,direction] of Object.entries({MB:'NW',AB:'W',YT:'NW',PE:'E',QC:'NE',NB:'E',BC:'W',NS:'E',NL:'E',NU:'N',NT:'NW',SK:'W'})) {
  const name=regionsById[code][1];
  const word=bearings.find(row=>row[0]===direction)[1];
  add('compass','route-'+code,'route',`From the centre of the Ontario marker, which arrow best points toward the ${name} marker?`,
    {answer:direction,region:code,note:`On this map the marked point is generally ${word} of the Ontario marker. Your direction can change when the start or end point changes.`});
}

for (const [id,prompt,answer,wrong,note] of [
 ['ski','How can building a ski resort affect a B.C. mountainside?','Clearing ski runs can remove trees and disturb wildlife habitat.',['It creates more ocean coast.','It moves rock to the top of the mountain.','It makes all mountain plants grow faster.'],'Building trails, lifts and roads can change how animals use a mountain.'],
 ['banff','Which words would help a tourist picture Banff National Park?','Rocky peaks, clear lakes and forests',['Red-sand beaches and ocean tides','Arctic islands and polar sea ice','Flat wheat fields and prairie grain elevators'],'Banff is in Alberta’s Rocky Mountains.'],
 ['breadbasket','Why is Saskatchewan called the Breadbasket of Canada?','Its farms grow a lot of wheat, which can be made into flour for bread.',['It has many oil wells.','It has the biggest ocean ports.','It grows Canada’s most potatoes.'],'Think wheat → flour → bread.'],
 ['sk-industries','Which three drawings match major Saskatchewan industries?','A wheat field, a mine and an oil pump',['A fishing boat, a lighthouse and a bridge','A ski lift, a whale and a waterfall','A maple tree, an ocean beach and a ferry'],'These show agriculture, mining, and oil and gas. Manufacturing also appears on the sheet.'],
 ['mb-crops','Which crops would fit a Manitoba farm sketch?','Wheat, barley and canola',['Coconuts, mangoes and bananas','Coffee, pineapples and cocoa','Lemons, olives and oranges'],'Canola is a crop with bright yellow flowers.'],
 ['mb-tools','Which machine plants seeds and which harvests the grain?','A seeder plants seeds. A combine harvests grain.',['A combine plants seeds. A seeder harvests grain.','A harvester plants trees. A plow waters crops.','A fishing boat plants seeds. A tractor catches fish.'],'A tractor can pull farm tools. A plow turns the soil.'],
 ['diversity','Which example shows diversity in a community?','Neighbours speak different languages and have different cultures and traditions.',['Everyone has the same hobbies and speaks the same language.','A street has only one house.','A city has more snow than last year.'],'Diversity means variety. People can differ in backgrounds, languages, religions and more.'],
 ['housing','How could Ontario add homes while protecting nature?','Build more homes near existing transit and protect wetlands and forests.',['Build on every wetland first.','Cut down all the forests near a city.','Build every home as far from buses and trains as possible.'],'Homes near existing streets and transit can use less undeveloped land.'],
 ['river','How did the St. Lawrence River influence Québec’s settlements and industries?','People built settlements and ports near the river because boats could carry people and goods.',['It prevented people from settling beside it.','It made ocean travel impossible.','It forced every town into the mountains.'],'Shipping, trade and fishing helped settlements grow along the river.'],
 ['french','What does it mean that French is Québec’s official language?','Québec recognizes French by law and uses it in government and public life.',['Everyone in Québec speaks only French.','French is the name of the capital.','French is used only on vacation.'],'An official language has a recognized role in government and institutions.'],
 ['fjord','What is a fjord?','A long, narrow inlet of the sea between steep sides, carved by glaciers.',['A flat meadow beside a river.','A tower that guides ships.','A round freshwater pond.'],'Picture seawater reaching between steep mountain walls.'],
 ['nl-tourism','Why does tourism matter in Newfoundland and Labrador?','Visitors come for fjords, puffins and historic sites, and their spending supports jobs.',['Visitors come mainly to cross the Confederation Bridge.','Tourists travel there only for wheat farming.','Tourism replaces all the other industries.'],'Examples include Gros Morne, Signal Hill and L’Anse aux Meadows.'],
 ['lighthouse','How does a lighthouse help boats off Nova Scotia?','Its light guides boats and warns them about rocky shores or other hazards.',['It raises the tide.','It makes boats go faster.','It marks the location of inland farms.'],'A beacon is especially helpful in darkness or poor visibility.'],
 ['ns-fishing','Why is fishing a major industry in Nova Scotia?','Its Atlantic coastline gives fishing boats access to marine life such as lobsters and scallops.',['It has no access to the ocean.','Its largest industry is wheat because it is landlocked.','The tides prevent boats from reaching the ocean.'],'Location connects local communities with fishing grounds.'],
 ['tide','When is it high tide?','When the sea reaches its highest level along the shore during a tide cycle.',['When the water level is lowest.','When wind makes any large wave.','When it starts raining.'],'At high tide, water covers more of the shore than it does at low tide.'],
 ['fundy','New Brunswick and Nova Scotia share which bay, famous for very high tides?','Bay of Fundy',['Hudson Bay','James Bay','Baffin Bay'],'Hopewell Rocks is a New Brunswick landmark on the Bay of Fundy.'],
 ['overfishing','What can happen when people catch fish faster than the fish can reproduce?','Fish populations can shrink.',['Fish populations always double.','Ocean water becomes fresh.','More beaches appear.'],'Fishing gear can also catch unintended animals or damage habitats.'],
 ['pei-size','What is a possible challenge in Canada’s smallest province, Prince Edward Island?','People may have fewer local choices for jobs, specialized services or transportation.',['It is harder to get seafood because it has no coast.','It has too many international borders.','It has the world’s longest mountain range.'],'For some services or work, people may need to travel farther.'],
 ['pei-bridge','How does Confederation Bridge help people and businesses in P.E.I.?','It gives vehicles a road link to New Brunswick and lets trucks carry goods.',['It carries ships between the Arctic and Pacific.','It connects P.E.I. directly to Newfoundland.','It takes cars straight to Ottawa.'],'The bridge crosses the Northumberland Strait to mainland Canada.'],
 ['nunavut','Which pair describes Nunavut and a challenge of Arctic cold?','Icy tundra and mountains; travel can be difficult and buildings need reliable heat.',['Tropical forests; households need shade from palm trees.','Prairies; warm ocean water keeps winter short.','Red-sand beaches; cold has no impact on travel.'],'People need warm clothing and reliable heating. Weather can delay travel and deliveries.'],
 ['nunavut-new','Which is Canada’s largest and newest territory?','Nunavut',['Yukon','Northwest Territories','Québec'],'Nunavut became a territory in 1999.'],
 ['nwt-animal','Which animal could a wildlife conservationist protect in the Northwest Territories?','Caribou',['Red panda','Kangaroo','Giant panda'],'Other examples from the worksheet include Arctic fox, muskox, grizzly bear and wolf.'],
 ['nwt-habitat','Which action helps caribou and their habitat?','Protect important habitat and migration routes.',['Build roads through every migration route.','Leave litter near watering areas.','Remove all plants from wilderness areas.'],'Follow wildlife rules and leave room for animals to move safely.'],
 ['gold','What happens during a gold rush?','Many people travel to an area after gold is discovered, hoping to find some.',['People rush to sell their bicycles.','A mine closes because no gold was found.','People travel to a harbour to catch lobsters.'],'The Klondike Gold Rush is a major part of Yukon history.'],
 ['yukon-mine','How does mining affect life in Yukon?','It creates jobs and supplies minerals, and mine sites need to be managed to protect land and water.',['It only creates jobs in fishing villages.','It turns tundra into an ocean.','It produces wheat and barley.'],'Mining can bring work and materials. Land and water can also be affected.'],
 ['flag','What appears on Manitoba’s provincial flag?','A red field, the Union Jack in the upper-left corner, and Manitoba’s shield with a bison.',['A large red maple leaf between two red bars.','A white polar bear with a blue border.','A sunflower beside a mountain.'],'The shield has a bison below the Cross of St. George. The Union Jack shows a historical tie to Britain.']
]) choose('concepts',id,prompt,answer,wrong,note);

for (const [id,prompt,answer] of [
 ['fjord','Type the word for a long, narrow sea inlet between steep sides.','fjord'],
 ['tundra','Type the name of the cold landscape where few trees grow.','tundra'],
 ['diversity','Type the word that means variety among people or things.','diversity'],
 ['gold-rush','Type the two-word term for people hurrying to a place where gold has been discovered.','gold rush'],
 ['tide','Type the two-word term for the highest water level of a tide cycle.','high tide'],
 ['fundy','Type the full name of the bay shared by New Brunswick and Nova Scotia.','Bay of Fundy'],
 ['bridge','Type the full name of the bridge from Prince Edward Island to New Brunswick.','Confederation Bridge'],
 ['river','Type the full name of the river that flows past Québec City.','St. Lawrence River'],
 ['canola','Type the name of the Manitoba crop with bright yellow flowers.','canola'],
 ['lighthouse','Type the word for a tower with a beacon that guides ships.','lighthouse']
]) spell('word-'+id,prompt,answer,'Say the word, then write it once more from memory.');

add('workshop','colour-map','paint-map','Colour all 13 regions differently, then place a star where you live.',{
  note:'Use one non-blue colour per region and keep the water blue. The star marks your own location.'
});
function project(id,prompt,mode,rubric,note) {
  add('workshop',id,mode,prompt,{rubric,note});
}
project('compass-sentences','Write four map sentences. Use north, east, south and west once each.','write',
 ['Four complete sentences use the four direction words.','Each sentence compares two named places and matches the map.'],
 'Example: Nunavut is north of Ontario. Québec is east of Ontario. British Columbia is south of Yukon. Manitoba is west of Ontario.');
project('original-flag','Draw Manitoba’s current flag and explain two of its symbols.','draw',
 ['A red field and a Union Jack in the upper-left corner.','The provincial shield includes a bison and a red cross.','The explanation connects a symbol to its meaning.'],
 'The Union Jack represents a historical tie to Britain. The bison represents Manitoba’s prairie heritage. The shield includes the Cross of St. George.');
project('new-flag','Design a new flag for Manitoba. Explain what your colours and symbols represent.','draw',
 ['A flag with at least one symbol connected to Manitoba.','Your explanation connects the colours or symbols to Manitoba.'],
 'Example: I drew a bison for the prairie and gold stripes for wheat fields. A blue stripe can represent Manitoba’s lakes.');
project('gold-draw','Draw a Yukon gold rush scene. Describe what the people are doing.','draw',
 ['The scene shows people searching for gold and where they are searching.','The explanation says why people moved there.'],
 'Example: Prospectors travelled to the Klondike and panned for gold in streams after hearing about the discovery.');
project('tide-draw','Sketch the same shore at high tide and low tide. Label both waterlines.','draw',
 ['Both waterlines are clearly labelled.','At high tide the water covers more of the shore.'],
 'Drawing the same rocks in both scenes makes the rise in water easy to see.');
project('fjord-draw','Sketch and label the seawater and steep sides of a fjord.','draw',
 ['A long, narrow stretch of water lies between steep land on both sides.','Labels name the seawater and the steep sides.'],
 'A glacier carved a valley. Seawater later filled the valley.');
project('wild-draw','Draw an animal native to the Northwest Territories. Explain one way to protect it.','draw',
 ['Your animal is native to the Northwest Territories.','Your explanation names its habitat or one specific way to protect it.'],
 'Example: A caribou needs safe migration routes. Protecting its routes gives it room to travel between seasonal habitats.');
project('farming-draw','Draw and label wheat, barley and canola. Name two tools you would use on the farm.','draw',
 ['Three crops are labelled wheat, barley and canola.','Two suitable farm tools are named.'],
 'A tractor can pull a seeder. A combine can harvest the grain. Canola has yellow flowers.');
project('bc-draw','Draw and label two different things you might see in British Columbia.','draw',
 ['Both drawings or descriptions show different things.','Both can be found in British Columbia.'],
 'Examples include mountains, Pacific salmon, evergreen forests and the Pacific coast.');
project('sk-draw','Draw three icons for Saskatchewan industries. Label each icon.','draw',
 ['Three different industries appear and are named.','Each icon matches the industry it represents.'],
 'Example: A crop for agriculture, a mine shaft for mining, and a pumpjack for oil and gas.');
project('diversity-draw','Draw a scene showing diversity in Ontario. Explain what makes it diverse.','draw',
 ['The scene shows people with different backgrounds, languages, faiths or traditions.','The explanation describes the variety you showed.'],
 'Example: At a school fair, families share different languages, foods, clothing and traditions.');
project('long-answers','Write three short answers. Explain how the St. Lawrence helped settlements grow, how the bridge helps P.E.I., and how Ontario could add housing while protecting nature.','write',
 ['You explain how people or goods moved by river and why towns grew there.','You explain that the bridge gives people and trucks a road link to New Brunswick.','You give one housing idea and explain how it protects land or habitats.'],
 'Ports grew where ships carried people and goods. The bridge links P.E.I. to the mainland. Ontario can build homes near transit and keep wetlands and forests intact.');
project('more-explanations','Explain two challenges of living in Nunavut, one effect of overfishing, and one way tourism helps Newfoundland and Labrador.','write',
 ['You name two challenges of Arctic cold.','You explain what can happen when fish are caught too quickly.','You connect tourism to visitors, local jobs or businesses.'],
 'Cold makes travel difficult and increases heating needs. Overfishing can reduce fish populations. Visitors pay for tours, food and lodging, which supports local jobs.');

const intro = 'Welcome to Canada Quest. I’m Harpreet, and this is Mehar. Explore the map, practise your spelling, then see how much you know.';

window.QUEST = {regions,regionsById,chapters,questions,bearings,intro};
