(() => {
  'use strict';

  const cue = (preset, x, y, width, options = {}) => ({
    preset, focus: {x, y}, width, cut: true, ...options
  });
  const mehar = (x, y, pose = 'idle', view = 'right', height = 330) => ['mehar', x, y, height, view, pose];
  const sidak = (x, y, pose = 'idle', view = 'left', height = 322) => ['boy', x, y, height, view, pose];
  const bibi = (x, y, pose = 'idle', view = 'left') => ['dadi', x, y, 395, view, pose];
  const courtyard = [mehar(490, 658), sidak(794, 653)];
  const tree = [mehar(515, 654, 'concern'), bibi(870, 648, 'point')];
  const dusk = [mehar(540, 661), sidak(795, 657)];
  const hands = [mehar(490, 658, 'reflect'), sidak(794, 653, 'concern')];

  window.KiteStory = {
    chapters: [
      {id:'intro', title:'The blue kite'},
      {id:'harvest', title:'A gust of wind'},
      {id:'storage', title:'Under the banyan'},
      {id:'requests', title:'Mehar tells the truth'},
      {id:'repair', title:'Mending the kite'},
      {id:'share', title:'Back in the sky'}
    ],
    speakers: {
      narrator: 'Storyteller', mehar: 'Mehar', boy: 'Sidak', dadi: 'Bibi Ji'
    },
    activities: {
      clue: {
        prompt: 'Where did the blue scrap land?',
        choices: [
          {id:'leaf', text:'By the dry leaf', x:430, y:597},
          {id:'scrap', text:'Beside the banyan root', x:756, y:590},
          {id:'stone', text:'By the pebble', x:973, y:611}
        ],
        answer:'scrap', retry:'Look for the blue shape beside the roots.',
        success:'You found the missing piece.'
      },
      truth: {
        prompt: 'What could Mehar tell Sidak?',
        choices: [
          {id:'wind', text:'“It was the wind.”'},
          {id:'truth', text:'“I took your kite without asking.”'}
        ],
        answer:'truth', retry:'The wind pulled the kite. What did Mehar do before that?',
        success:'Mehar tells Sidak what happened.'
      },
      patch: {
        prompt: 'Which patch fits the torn corner?',
        choices: [
          {id:'circle', text:'Round patch', x:1005, y:195},
          {id:'square', text:'Square patch', x:1005, y:343},
          {id:'triangle', text:'Jagged triangle', x:1005, y:492}
        ],
        answer:'triangle', retry:'Follow the jagged edge of the missing corner.',
        success:'The torn edges line up.'
      },
      smooth: {
        prompt: 'Press the patch flat.',
        choices: [{id:'press', text:'Smooth the patch', x:738, y:324}],
        answer:'press', success:'The patch lies flat.'
      },
      tail: {
        prompt: 'Tie the red tail to the point at the bottom.',
        choices: [{id:'knot', text:'Tie the tail', x:640, y:499}],
        answer:'knot', success:'The tail is tied back on.'
      }
    },
    shots: [
      {
        chapter:'intro', line:'village', seconds:16, bg:'banyan', cast:[], props:'teaser',
        camera:cue('establishing', 580, 370, 1190, {cut:false, motion:'dolly-in', duration:11000, parallax:true}),
        technique:'Establishing wide · layered dolly',
        purpose:'The mustard field, path, and banyan show where the chase will happen. Leaves closer to the lens move faster.'
      },
      {
        chapter:'intro', line:'water', seconds:10, bg:'courtyard', cast:courtyard, props:'bench',
        camera:cue('two-shot', 650, 482, 1050),
        technique:'Eye-level two-shot', purpose:'Mehar and Sidak share the frame while he offers to fly the kite with her.'
      },
      {
        chapter:'intro', line:'admire', seconds:12, bg:'courtyard', cast:[mehar(490,658,'wonder')], props:'bench',
        camera:cue('extreme-close-up', 687, 500, 360),
        technique:'Insert · the red tail', purpose:'The fluttering tail catches Mehar’s attention before she picks up the reel.'
      },
      {
        chapter:'intro', line:'once', seconds:11, bg:'courtyard', cast:[mehar(490,658,'reflect')], props:'bench',
        camera:cue('close-up', 492, 412, 434),
        technique:'Reaction close-up', purpose:'Mehar’s hesitation gets its own beat before her choice.'
      },
      {
        chapter:'harvest', line:'chase', seconds:13, bg:'banyan', cast:[mehar(370,657,'alarm')], props:'chase',
        walk:{id:'mehar', x:770, y:632, seconds:8}, effect:'gust',
        camera:cue('full', 390, 509, 1060, {motion:'tracking', track:'mehar', parallax:true}),
        technique:'Tracking shot · walking rig', purpose:'The frame follows Mehar as she hurries after the kite. She moves across the path while the background and foreground shift at different rates.'
      },
      {
        chapter:'harvest', line:'stop', seconds:5, bg:'banyan', cast:[mehar(770,632,'alarm')], props:'snag', effect:'rip',
        camera:cue('wide', 760, 370, 1120, {cut:false, motion:'dolly-in', angle:'dutch', roll:4.2, duration:420}),
        technique:'Dutch angle · a brief roll', purpose:'The picture tilts just as the string catches. The next cut levels the frame.'
      },
      {
        chapter:'harvest', line:'stuck', seconds:12, bg:'canopy', cast:[], props:'canopy',
        camera:cue('pov', 760, 348, 980, {angle:'pov'}),
        technique:'Mehar’s point of view', purpose:'An upward painting shows the underside of the branch and the torn paper falling toward Mehar.'
      },
      {
        chapter:'storage', line:'branch', seconds:11, bg:'banyan', cast:tree, props:'rescue',
        camera:cue('wide', 710, 412, 1150),
        technique:'Eye-level wide', purpose:'The branch, stick, and both characters stay visible during the retrieval.'
      },
      {
        chapter:'storage', line:'scrap', seconds:13, bg:'banyan', cast:[mehar(535,654,'point'), bibi(890,650,'happy')], props:'clues',
        activity:'clue', camera:cue('wide', 640, 360, 1280),
        technique:'Interactive wide', purpose:'The ground stays level and still while players search three spots.'
      },
      {
        chapter:'storage', line:'footsteps', seconds:13, bg:'banyan', cast:[mehar(780,650,'reflect','left')], props:'return',
        walk:{id:'mehar', x:490, y:670, seconds:7}, effect:'steps',
        camera:cue('full', 790, 500, 980, {motion:'tracking', track:'mehar', parallax:true}),
        technique:'Return tracking shot', purpose:'A slower pace and quieter music follow Mehar back toward the courtyard.'
      },
      {
        chapter:'requests', line:'ask', seconds:8, bg:'courtyard', cast:hands, props:'torn',
        camera:cue('two-shot', 650, 477, 930),
        technique:'Two-shot · the question', purpose:'Sidak can see the torn kite in Mehar’s hands.'
      },
      {
        chapter:'requests', line:'thought', seconds:13, bg:'courtyard', cast:hands, props:'reel',
        camera:cue('extreme-close-up', 543, 511, 290),
        technique:'Extreme close-up · the reel', purpose:'The reel in Mehar’s hands brings her attention back to her own choice.'
      },
      {
        chapter:'requests', line:'confess', seconds:11, bg:'courtyard', cast:[mehar(490,658,'concern'), sidak(794,653,'concern')], props:'torn',
        activity:'truth', camera:cue('medium-close', 518, 447, 580),
        technique:'Medium close-up · the confession', purpose:'Mehar’s face and open hand stay in the frame while she apologizes.'
      },
      {
        chapter:'requests', line:'hurt', seconds:11, bg:'courtyard', cast:[mehar(490,658,'reflect'), sidak(794,653,'concern')], props:'torn',
        camera:cue('close-up', 794, 413, 478),
        technique:'Reverse close-up · Sidak', purpose:'Sidak has room to explain why the kite matters to him.'
      },
      {
        chapter:'requests', line:'help', seconds:11, bg:'courtyard', cast:[mehar(490,658,'offer'), sidak(794,653,'reflect')], props:'torn',
        camera:cue('two-shot', 654, 476, 930),
        technique:'Two-shot · an offer to help', purpose:'Both reactions are visible when Mehar offers to help with the repair.'
      },
      {
        chapter:'requests', line:'patience', seconds:12, bg:'courtyard', cast:[mehar(445,658,'reflect'), sidak(650,657,'reflect','right'), bibi(895,650,'explain')], props:'torn',
        camera:cue('wide', 670, 455, 1140),
        technique:'Steady three-shot', purpose:'Bibi Ji joins the two children while they work out what to do next.'
      },
      {
        chapter:'repair', line:'paper', seconds:11, bg:'workbench', cast:[], props:'patch', activity:'patch',
        camera:cue('wide', 640, 360, 1280, {angle:'birds-eye'}),
        technique:'Bird’s-eye view · match the patch', purpose:'The tabletop is drawn from directly above so the paper edges are easy to compare.'
      },
      {
        chapter:'repair', line:'smooth', seconds:9, bg:'workbench', cast:[], props:'smooth', activity:'smooth',
        camera:cue('medium', 735, 334, 760, {angle:'birds-eye'}),
        technique:'Bird’s-eye insert · press the paper', purpose:'In Watch mode the frame tightens on the seam as it flattens.'
      },
      {
        chapter:'repair', line:'tail', seconds:8, bg:'workbench', cast:[], props:'tie', activity:'tail',
        camera:cue('medium', 672, 488, 810, {angle:'birds-eye'}),
        technique:'Bird’s-eye insert · tie the tail', purpose:'The lower point stays visible while the red ribbon is tied on.'
      },
      {
        chapter:'repair', line:'ready', seconds:9, bg:'workbench', cast:[], props:'fixed',
        camera:cue('wide', 640, 360, 1280, {angle:'birds-eye'}),
        technique:'Bird’s-eye wide · the finished kite', purpose:'The completed kite fills the same work surface, including its blue patch.'
      },
      {
        chapter:'share', line:'askFirst', seconds:9, bg:'sunset', cast:[mehar(540,661,'wonder'), sidak(795,657,'happy')], props:'handoff',
        camera:cue('two-shot', 680, 490, 1050),
        technique:'Golden-hour two-shot', purpose:'Mehar asks first this time, with Sidak and the reel in the frame.'
      },
      {
        chapter:'share', line:'together', seconds:9, bg:'sunset', cast:[mehar(540,661,'happy'), sidak(795,657,'offer')], props:'handoff', handoff:true,
        camera:cue('medium', 665, 483, 760),
        technique:'Medium · passing the reel', purpose:'Both hands stay on screen as they prepare to launch.'
      },
      {
        chapter:'share', line:'lift', seconds:15, bg:'sunset', cast:dusk, props:'launch', effect:'lift',
        start:cue('two-shot', 684, 484, 1060),
        camera:cue('wide', 685, 320, 1150, {cut:false, motion:'tilt', duration:5100, parallax:true}),
        technique:'Tilt up · the launch', purpose:'The frame rises with the repaired kite from the children’s hands to the sky.'
      },
      {
        chapter:'share', line:'last', seconds:8, bg:'sunset', cast:[mehar(540,661,'happy'), sidak(795,657,'proud')], props:'airborne',
        camera:cue('two-shot', 665, 415, 1060),
        technique:'Two-shot · sharing the reel', purpose:'The friends and their kite share the frame one more time.'
      },
      {
        chapter:'share', line:'meaning', seconds:18, bg:'sunset', cast:[mehar(540,661,'happy'), sidak(795,657,'happy')], props:'airborne',
        start:cue('two-shot', 680, 385, 925),
        camera:cue('extreme-wide', 640, 360, 1280, {cut:false, motion:'dolly-out', duration:10500, parallax:true}),
        technique:'Closing wide · slow dolly out', purpose:'The friends grow small against the field and sky as the repaired kite keeps flying.'
      }
    ]
  };
})();
