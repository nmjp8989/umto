const assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const {pathToFileURL}=require('node:url');const path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
const result=await p.evaluate(()=>{
 // Verify support, forward knee bend, opposite steps, and seamless loop boundaries.
 for(const side of [-1,1])for(let i=0;i<=120;i++){
  const t=i/100,g=walkingStep(t,side),next=walkingStep(t+.00001,side);
  if(g.stance&&g.lift!==0)throw Error('Supporting foot lifted');
  if(g.kneeForward*g.down-g.kneeDown*g.forward < -1e-6)throw Error('Knee bent backwards');
  if(Math.abs(next.forward-g.forward)>1||Math.abs(next.lift-g.lift)>1)throw Error('Gait discontinuity');
  const loop=walkingStep(t+1.2,side);if(Math.abs(loop.forward-g.forward)>1e-8)throw Error('Loop seam');
  if(!g.stance&&!walkingStep(t,-side).stance)throw Error('Both feet airborne');
 }
 state.gazeX=0;state.gazeY=0;
 for(const view of ['left','front','right']){cameraView=view;const g=eyeGaze('open');if(g.x!==cameraDirections[view]*.8)throw Error('Gaze does not follow face');for(const style of Object.keys(eyeStyles)){state.eyeStyle=style;render();if(document.querySelector('#eyeGroup').innerHTML.includes('NaN'))throw Error('Invalid eye geometry');}if(eyeGaze('left').x!==-1||eyeGaze('right').x!==1)throw Error('Explicit look lost');}
 const version=document.title.match(/v(\d+)/)?.[1];if(!version||!document.querySelector('.appbar').textContent.includes(version))throw Error('Build label mismatch');
 const socketCheck=()=>{for(const arm of document.querySelectorAll('#torso [data-rig-arm]')){const fixed=new DOMPoint(0,48).matrixTransform(arm.getCTM()),moving=new DOMPoint(0,48).matrixTransform(arm.querySelector('[data-rig-shoulder]').getCTM());if(Math.hypot(fixed.x-moving.x,fixed.y-moving.y)>.001)throw Error('Shoulder left socket');}};
 const sample=document.createElementNS(svg.namespaceURI,'g');svg.append(sample);
 const noseCenter=()=>{
  const mark=sample.querySelector('circle');
  return new DOMPoint(627,694).matrixTransform(mark.getCTM()).matrixTransform(sample.getCTM().inverse()).x;
 };
 const noseMark='<circle cx="627" cy="694" r="1"/>';
 for(const view of ['front','left','right']){
  const turn=cameraDirections[view];
  sample.innerHTML=projectCameraMarkup('noseGroup',noseMark,view);
  const center=noseCenter();
  const depth=(center-cameraX(627,turn))*turn;
  if(turn?(depth<8||depth>16):Math.abs(center-627)>.01)throw Error('Nose is off the facial centerline in '+view);
  state.noseW=140;
  sample.innerHTML=adjustedFeatureSvg('noseGroup',projectCameraMarkup('noseGroup',noseMark,view),view);
  if(Math.abs(noseCenter()-center)>.01)throw Error('Nose width shifts its center in '+view);
 }
 state.noseW=100;
 for(const covering of ['tuckedChunni','patka']){
  sample.innerHTML=headwearSvg(covering,'#55496c');
  const shapes=[...sample.querySelectorAll('path[fill="#55496c"]')];
  if(shapes.length!==1)throw Error('Detached fabric on '+covering);
  const shape=shapes[0],box=shape.getBBox();
  if(box.x<5||box.x+box.width>107||box.y+box.height>94||!shape.isPointInFill(new DOMPoint(52,31)))throw Error('Head covering left the skull on '+covering);
 }
 sample.remove();
 for(const preset of ['elder-bibi-ji','elder-bibi'])for(const view of ['front','left','right']){
  const actor=newSceneActor(preset,0);actor.view=view;
  const node=createSceneActor(actor,991);
  document.body.append(node.svg);
  const head=node.layers.headwearFront.querySelector('[data-chunni-head]');
  const drape=node.layers.torso.querySelector('[data-chunni-shoulders]');
  if(!head||!drape)throw Error('Bibi Ji’s chunni is missing in '+preset+' '+view);
  const fabric=head.querySelector('path'),sameFabric=drape.querySelector('path');
  if(fabric.getAttribute('fill')!==sameFabric.getAttribute('fill'))throw Error('Head and shoulders use different scarf colours');
  if(!fabric.isPointInFill(new DOMPoint(52,28))||fabric.isPointInFill(new DOMPoint(52,85)))throw Error('Chunni does not frame the face');
  sceneWithState(actor,()=>paintSceneActorFace(node,reactionPose('nod',1.2)));
  if(head.getBoundingClientRect().bottom<=drape.getBoundingClientRect().top)throw Error('Chunni lost its shoulder overlap while nodding');
  node.svg.remove();
 }
 for(const hair of Object.keys(indianLongHair))for(const view of ['front','left','right']){state.hair=hair;cameraView=view;render();if(!document.querySelector('#frontHair path'))throw Error('Missing long hair');}
 if(premadeCharacters.filter(p=>p.id.startsWith('india-')).length!==8)throw Error('Indian presets missing');
 feature='hair';for(const section of ['girls','boys','all']){hairSection=section;drawDesigns();if(!document.querySelector('[data-hair-section="'+section+'"][aria-pressed="true"]'))throw Error('Hair filter broken');}
 // The same filled skin path must contain the wrist, the hand and a point
 // well up the forearm, including when the hand rolls independently.
 state.shirt='linenTunic';state.framing='full';
 for(const view of ['front','left','right']){
  cameraView=view;render();
  const arms=[...document.querySelectorAll('#torso [data-rig-arm]')];
  for(const pose of ['relaxed','wave','open','point','fist'])for(const bend of [-48,0,52]){
   const spec={pose,view:pose==='relaxed'?'edge':'palm'};
   setBodyArmPose({left:[-12,-87,bend],right:[8,-35,-bend]},{left:spec,right:spec});
   for(const arm of arms){
    const skin=arm.querySelector('[data-arm-skin]'),elbow=arm.querySelector('[data-rig-elbow]'),wrist=arm.querySelector('[data-rig-wrist]');
    const contains=(joint,x,y)=>skin.isPointInFill(new DOMPoint(x,y).matrixTransform(joint.getCTM()).matrixTransform(skin.getCTM().inverse()));
    if(!contains(elbow,0,48)||!contains(wrist,0,26))throw Error('Forearm or palm disconnected '+pose);
    for(const y of [-8,0,8])for(const x of [-10,0,10])if(!contains(wrist,x,y))throw Error('Wrist gap '+pose+' '+bend);
   }
  }
 }
 // One fitted outline covers the bend and the cuff, without round elbow caps.
 state.shirt='crew';
 for(const view of ['front','left','right']){
  cameraView=view;render();
  for(const angle of [-145,-103,-45,0,45,103,145]){
   setBodyArmPose({left:[-35,angle,14],right:[-28,-angle,-14]});
   for(const arm of document.querySelectorAll('#torso [data-rig-arm]')){
    const surface=arm.querySelector('[data-sleeve-surface]'),elbow=arm.querySelector('[data-rig-elbow]');
    if(!surface||arm.querySelectorAll('[data-sleeve-surface]').length!==1)throw Error('Split sleeve outline');
    for(const y of [0,22,100,BODY_RIG.forearm-10]){
     const point=new DOMPoint(0,y).matrixTransform(elbow.getCTM()).matrixTransform(surface.getCTM().inverse());
     if(!surface.isPointInFill(point))throw Error('Sleeve left a gap at '+view+' '+angle+' '+y);
    }
   }
  }
 }
 const styles=Object.keys(WARDROBE);let checks=0;
 for(const shirt of styles)for(const view of ['front','left','right'])for(const framing of ['head','full']){
  state.shirt=shirt;cameraView=view;state.framing=framing;render();
  const legSurfaces=[...document.querySelectorAll('#torso [data-leg-surface]')];
  const geometry=()=>JSON.stringify([...document.querySelectorAll('#torso path')].filter(n=>!n.closest('[data-hand-action], [data-sleeve-surface]')).map(n=>n.getAttribute('d')));
  const original=geometry();const nodes=[...document.querySelectorAll('#torso [data-rig-arm]')];
  for(const time of [0,.2,1,2.8,3.5]){poseHeadshotArms(reactionPose('wave',time));socketCheck();if(geometry()!==original)throw Error('Geometry changed '+shirt);if(nodes.some(n=>!n.isConnected))throw Error('Rig replaced mid-animation');checks++;}
  if(framing==='full'){for(const time of Array.from({length:24},(_,i)=>i*.05)){poseWalking(time);socketCheck();if(document.getElementById('torso').innerHTML.includes('NaN'))throw Error('Invalid gait');
   for(const leg of document.querySelectorAll('#torso [data-rig-leg]')){
    const side=+leg.dataset.rigLeg,g=walkingStep(time,side),turn=cameraDirections[view],x=standingKneeX(bodyBottomProfile(),bodyAnkleX()),cloth=leg.querySelector('[data-leg-surface]');
    const knee=new DOMPoint(x+turn*side*.72*g.kneeForward,g.kneeDown);
    if(!legSurfaces.includes(cloth)||!cloth.isPointInFill(knee))throw Error('Uncovered knee '+shirt+' '+view);
    if(leg.querySelectorAll('[data-leg-surface]').length!==1)throw Error('Duplicate trouser segment');
   }
   const rig=document.querySelector('#torso [data-body-rig]'),fills=[...document.querySelectorAll('#torso [data-leg-surface],#torso [data-rig-pelvis] path')].filter(p=>p.getAttribute('fill')===state.trouserColour);
   for(const dx of [-90,-45,0,45,90])for(const y of [1450,1500,1550]){
    const point=new DOMPoint(bodyCameraX(627+dx,cameraDirections[view]),y).matrixTransform(rig.getCTM());
    if(!fills.some(path=>path.isPointInFill(point.matrixTransform(path.getCTM().inverse()))))throw Error('Hip coverage gap '+view+' '+time+' '+dx+' '+y);
   }
   for(const arm of nodes)if(arm.querySelector('[data-action-hand]').dataset.actionHand!=='relaxed')throw Error('Walking lost relaxed hand');}render();if(document.querySelector('#torso [data-rig-hip]').hasAttribute('transform'))throw Error('Gait reset failed');}
  if(nodes.length!==2)throw Error('Expected exactly two arms');
  if(framing==='full'&&document.querySelectorAll('#torso [data-rig-knee]').length!==2)throw Error('Leg joint missing');
 }
 state.framing='head';cameraView='front';render();poseHeadshotArms(reactionPose('explain',1));
 if(document.querySelectorAll('#torso [data-hand-action][display="inline"] [data-action-hand="palmUp"]').length!==1||document.querySelectorAll('#torso [data-hand-action][display="inline"] [data-action-hand="point"]').length!==1)throw Error('Explaining hand states lost');

 state.pose='relaxed';state.armPose='rest';
 for(const key of ['wave','explain','point','shrug','celebrate','thumbsUp','stop','welcome','countOne','bow','dance']){
  const sample=time=>{
   const p=reactionPose(key,time);
   return ['left','right'].flatMap(side=>{
    const [shoulder,elbow,wrist]=p.arms[side];
    return [shoulder,elbow,wrist+(p.hands?.[side]?.roll??0)];
   });
  };
  for(let i=0;i<360;i++){
   const pose=sample(i/100),next=sample((i+1)/100);
   if(pose.some((angle,j)=>Math.abs(angle-next[j])>6))throw Error('Arm snaps during '+key+' at '+i/100);
   if(Math.abs(pose[1])>135||Math.abs(pose[4])>135||Math.abs(pose[2])>38||Math.abs(pose[5])>38)throw Error('Overturned joint during '+key);
  }
  const rest=[-3,0,0,-3,0,0];
  for(const time of [0,.01,2.99,3.6]){
   if(sample(time).some((angle,j)=>Math.abs(angle-rest[j])>.35))throw Error('Gesture misses resting pose in '+key);
  }
 }

 scene.cast=[newSceneActor('kid-sidak',0),newSceneActor('kid-meher',1)];
 scene.cast.forEach(actor=>{actor.action='talk';});
 scene.alternate=true;
 rebuildSceneCast();
 const sceneElbows=time=>{
  paintScene(time);
  return scene.nodes.map(node=>node.svg.querySelector('[data-rig-arm="-1"] [data-rig-elbow]').transform.baseVal.getItem(0).angle);
 };
 const firstTurn=sceneElbows(1),secondTurn=sceneElbows(3.4);
 if(firstTurn[0]>-50||firstTurn[1]!==0||secondTurn[1]>-50||secondTurn[0]!==0)throw Error('A listener gestured during the other speaker’s turn');
 for(const time of [2.39,2.41]){
  if(sceneElbows(time).some(angle=>Math.abs(angle)>1))throw Error('Arms snap at a speaker handoff');
 }

 WARDROBE.testDesign={label:'Test',template:'short',neck:'v',pocket:true};state.shirt='testDesign';render();if(!document.querySelector('[data-garment="testDesign"]'))throw Error('Registry addition failed');delete WARDROBE.testDesign;render();if(!document.querySelector('[data-garment="crew"]'))throw Error('Removed design fallback failed');
 return {styles:styles.length,checks,templates:Object.keys(GARMENT_TEMPLATES).length};
});assert.deepEqual(errors,[]);console.log('PASS',result);await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
