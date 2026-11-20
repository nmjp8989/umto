#!/usr/bin/env node
/* Little Panth Mission 04 full-spread YouTube exporter · 1920x1080, 30fps.
   Captures the actual two-page browser display and Gemini voices at the same time.
   GitHub Actions runs this; no secrets enter browser-side code. */
const { chromium } = require('playwright-core');
const { spawn, spawnSync } = require('node:child_process');
const { mkdir, rm, writeFile, rename } = require('node:fs/promises');
const { once } = require('node:events');
const path = require('node:path');
const out = path.resolve(process.argv[2] || 'little-panth-004-video');
const width = 1920, height = 1080, fps = 30;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function encoder(args) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-6000); });
  // A failed encoder can close its input before the producer sees the exit.
  child.stdin.on('error', () => {});
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(Error('FFmpeg exited ' + code + ': ' + errors)));
  });
  done.catch(() => {});
  return { child, done };
}

function beginAudio(file) {
  const audio = encoder([
    '-stats_period', '0.1', '-progress', 'pipe:1', '-f', 'pulse', '-fragment_size', '1920',
    '-i', 'lp_export.monitor', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', file
  ]);
  let resolveStart;
  const firstSample = new Promise(resolve => { resolveStart = resolve; });
  let output = '';
  audio.child.stdout.on('data', chunk => {
    output += chunk;
    const lines = output.split('\n');
    output = lines.pop();
    for (const line of lines) {
      const match = /^out_time_us=(\d+)$/.exec(line.trim());
      if (match && +match[1] > 0) resolveStart(Date.now() - Math.round(+match[1] / 1000));
    }
  });
  const timeout = setTimeout(() => audio.child.kill(), 20_000);
  return {
    ...audio,
    ready: Promise.race([firstSample, audio.done.then(() => { throw Error('Audio capture ended before playback'); })])
      .finally(() => clearTimeout(timeout)),
    async stop() {
      if (audio.child.exitCode === null && audio.child.signalCode === null) audio.child.stdin.end('q\n');
      await audio.done;
    }
  };
}

async function beginFrames(page, file) {
  const cdp = await page.context().newCDPSession(page);
  let latest;
  let received = 0;
  cdp.on('Page.screencastFrame', frame => {
    latest = Buffer.from(frame.data, 'base64');
    received++;
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: width, maxHeight: height });
  for (let attempt = 0; !latest && attempt < 50; attempt++) await delay(100);
  if (!latest) throw Error('Chromium provided no frames');

  const video = encoder([
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    '-threads', '2', '-pix_fmt', 'yuv420p', file
  ]);
  let timer;
  let written = 0;
  let blocked = false;
  const input = video.child.stdin;
  input.on('drain', () => { blocked = false; });
  function writeUntil(total) {
    while (!blocked && written < total) {
      if (input.destroyed) throw Error('Video encoder closed before the end of the section');
      blocked = !input.write(latest);
      written++;
    }
  }
  return {
    start(started) {
      timer = setInterval(() => {
        if (!input.destroyed) writeUntil(Math.floor((Date.now() - started) * fps / 1000));
      }, 12);
    },
    async stop(frameCount) {
      clearInterval(timer);
      if (frameCount) {
        // Finish any frames still waiting on FFmpeg input backpressure.
        while (written < frameCount) {
          if (blocked) await Promise.race([once(input, 'drain'), video.done.then(() => { throw Error('Video encoder exited early'); })]);
          writeUntil(frameCount);
        }
      }
      input.end();
      await cdp.send('Page.stopScreencast').catch(() => {});
      await video.done;
      console.log('Captured browser updates: ' + received + '; encoded frames: ' + written);
    },
    abort() {
      clearInterval(timer);
      video.child.kill();
    }
  };
}

function finalize(video, audio, trimStart) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'info', '-y', '-i', video, '-ss', trimStart.toFixed(3), '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', 'volumedetect,apad',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', path.join(out, 'section.mp4')
  ], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error || Error(result.stderr);
  const level = /mean_volume:\s*(-?[\d.]+) dB/.exec(result.stderr);
  if (!level || Number(level[1]) < -55) throw Error('The browser audio recording is silent or too quiet');
  console.log('Audio mean level: ' + level[1] + ' dB');
}

async function render() {
  await mkdir(out,{recursive:true});
  const videoFile=path.join(out,'picture.mp4');
  const audioFile=path.join(out,'browser.wav');
  const browser=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--mute-audio'],
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-dev-shm-usage']});
  let audio,frames,status,trimStart,completed=false,startedAt=0;
  try{
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8765/little%20panth/mission-004/?export=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.lp004Export?.ready(),null,{timeout:120000});
    frames=await beginFrames(page,videoFile);
    audio=beginAudio(audioFile);
    const audioStart=await audio.ready;
    startedAt=await page.evaluate(()=>window.lp004Export.start());
    trimStart=Math.max(0,(startedAt-audioStart)/1000);
    frames.start(startedAt);
    const deadline=Date.now()+24*60*1000;
    let thumbnail=false;
    do{
      if(errors.length)throw Error('Browser errors: '+errors.join('; '));
      status=await page.evaluate(()=>window.lp004Export.status());
      if(status.error)throw Error(status.error);
      if(!thumbnail&&Date.now()-startedAt>3500){
        await page.screenshot({path:path.join(out,'thumbnail.png'),timeout:20000});
        thumbnail=true;
      }
      if(status.finished)break;
      await delay(150);
    }while(Date.now()<deadline);
    if(!status.finished)throw Error('Episode export exceeded deadline (chapter '+status.phase+')');
    if(status.captions.length!==25)throw Error('Not all 25 dialogues were captured; got '+status.captions.length);
    await frames.stop(Math.round((status.finished-status.started)*fps/1000));
    completed=true;
  }finally{
    if(frames&&!completed)frames.abort();
    try{if(audio)await audio.stop()}finally{await browser.close()}
  }
  finalize(videoFile,audioFile,trimStart);
  await rename(path.join(out,'section.mp4'),path.join(out,'mission-004.mp4'));
  function stamp(ms){
    const v=Math.max(0,Math.round(ms)),h=Math.floor(v/3600000),m=Math.floor(v/60000)%60,s=Math.floor(v/1000)%60,rem=v%1000;
    return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+','+String(rem).padStart(3,'0');
  }
  const captions=status.captions.map((c,i)=>(i+1)+'\n'+stamp(c.start)+' --> '+stamp(c.end)+'\n'+c.text.replace(/\n/g,' ')+'\n').join('\n');
  await writeFile(path.join(out,'mission-004-pa.srt'),captions,'utf8');
  await writeFile(path.join(out,'dialogue-timings.json'),JSON.stringify(status.captions,null,2),'utf8');
  await Promise.all([rm(videoFile),rm(audioFile)]);
  console.log('Exported Mission 04: '+status.captions.length+' dialogue clips; '+((status.finished-status.started)/1000).toFixed(1)+'s at 1920x1080, 30fps.');
}
render().catch(err=>{console.error(err);process.exitCode=1});
