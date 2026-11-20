# Mission JSON format (v2)

**One player, separate stories.** A mission is plain JSON. There is no JavaScript code inside the story. `mission-engine.js` evaluates conditions and changes state; `player.js` draws the scenes, handles input, dialogue, music and cut-frame animations. `mission-props.js` is the reusable catalogue of SVG objects.

Start with [mission.json](mission.json), which is the complete working example.

## Minimum mission data

```json
{
  "id": "my-adventure",
  "version": 2,
  "title": "My Adventure",
  "startScene": "room",
  "startMessage": "hello",
  "hero": {
    "id": "character", "name": "The Hero",
    "layout": {"room": [665,128,220,394]},
    "label": {"room": [773,105,150]}
  },
  "scenes": {
    "room": {
      "name": "The room", "icon": "⌂", "art": "home", "music": "home",
      "objects": [
        {"id": "sofa", "type": "sofa", "name": "Sofa — sit down"}
      ]
    }
  },
  "dialogues": {
    "hello": {"text": "Welcome! Tap the sofa."},
    "seated": {"text": "Comfy!"}
  },
  "rules": [
    {"when": "click:sofa", "in": "room", "actions": ["pose:sit", "message:seated"]}
  ],
  "objectives": [{"text": "Explore the room"}],
  "hints": [{"text": "Tap the sofa."}]
}
```

To play a separate adventure without changing the first one, save it as `missions/adventures/my-adventure.json` and open `/missions/?mission=my-adventure`. The player only accepts short lowercase filename slugs from the local `adventures/` folder (not arbitrary paths or remote URLs). The default `/missions/` loads `mission.json`. There is no visual mission picker or authoring UI yet.

### Scenes and props

- Each scene has `name`, `art` (a scenery key in `assets.js`), `music` (a synthesized soundtrack preset), and `objects`.
- Each object has `id`, `type` (sprite key in `mission-props.js`) and `name`; it may also have `if`, `badge: [text,x,y,width]`, `hitbox: [x,y,width,height]`, or `interactive:false`. Coordinates use the 1280×650 SVG world.
- `hero.layout` uses `[x,y,width,height]` for scene/pose positions. `hero.label` is `[x,y,width]`. Character art comes from Anitoons' existing rig bridge.
- `inventoryItems` maps item IDs to labels and visual keys. `draggable` lists item IDs that can be dragged or tapped then combined.

### Rules and effects

Events are strings such as `click:cupboard`, `drop:cup:character`, `enter:yard`, and `navigate:yard`. Multiple rules can have the same event; the **first rule whose scene and conditions match** is used. Conditions are AND-separated with `+`, and `!` negates:

```json
{"when":"drop:key:scooter","in":"yard","if":"inventory.key+!unlocked",
 "actions":["flag:unlocked","sound:unlock","message:keyUnlocked"]}
```

Condition tokens: `tea` (flag), `!tea`, `inventory.key`, `visible.key`, `scene.yard`, `pose.sit`, `started`, `ending`, `complete`.

State-changing actions: `flag:x`, `unflag:x`, `inventory:x`, `remove:x`, `show:x`, `hide:x`, `pose:x`, `scene:x`, `ending:complete`. Browser actions: `message:id`, `sound:cue`, `select:id`, `event:another:event`, and `cutscene:id`.

To transition between scenes, define a corresponding navigation rule:

```json
{"when":"navigate:yard","in":"home","actions":["scene:yard"]}
```

The player invokes `enter:yard` after changing the scene, allowing a conditional arrival dialogue. The final `ending:complete` action should follow a cutscene; the engine calls `finish()` only once the playback completes.

### Dialogue and choices

```json
"question": {
  "text": "Where should we go?",
  "choices": [
    {"label": "Go outside", "scene": "yard"},
    {"label": "Open cupboard", "event": "click:cupboard"},
    {"label": "Ask again", "message": "question", "if": "tea"}
  ]
}
```

`objectives`, `hints` and `progressLabels` are ordered arrays of `{if?,text}`; the first matching entry wins. `progress` entries are achievement conditions counted in the progress bar.

### Limited-animation cutscenes

```json
"cutscenes": {
  "departure": {
    "music": "cutscene",
    "frames": [
      {"caption": "The engine starts…", "duration": 850, "style": "riding"},
      {"caption": "And away!", "duration": 2500, "style": "depart"}
    ]
  }
}
```

For now, the player recognizes `riding` and `depart` as optional presentation effects; a future version can add more to the reusable animation catalogue. Sounds are generated locally by Web Audio, not external files.

## Checks

```sh
node tests/missions.cjs
node --check missions/mission-engine.js
node --check missions/player.js
node --check missions/mission-props.js
```

A JSON mission is **not** an executable script. Do not accept arbitrary JavaScript, inline SVG, or remote URLs as new action types; extend the vetted renderer and action catalogue instead.

**Not in v2:** a visual mission editor, auto-generating JSON from prompts, user accounts, persistence, dynamically importing new artwork, or mobile packaging. The current mission remains a static, offline-capable web implementation (served via HTTP, with no external APIs).


## Cinematic direction (shared camera)

Future missions must plan a purposeful shot list: establishing wide shot, dialogue coverage, reaction close-ups, inserts of important objects, motivated tracking or dolly moves, and a closing wide shot. Use wide framing for puzzles and navigation; honor reduced-motion preferences. Avoid camera moves that distract from Gurbani or teaching.

Delivery sequences accept a camera cue before a line or effect, e.g. `{"camera":{"preset":"close-up","target":"harpreet","duration":800,"motion":"dolly-in"}}`. Optional dialogue `camera` uses the same object or preset string. Focus is in 1280×720 coordinates. Set `focus:{"x":640,"y":360}`, `width` (180–1280), `cut:true`, `duration` in ms, or `angle:"dutch"` for roll. `motion:"tracking"` follows the specified actor (`track` id). Other motion labels describe the intended move; successive differently framed cues with durations produce pan/truck, tilt/crane, dolly/zoom or fly-through approximations. For dedicated noninteractive artwork wrappers with no existing transforms and adequate overscan, `data-camera-depth` (-1 to 1) and `parallax:true` enable differential horizontal shifts.

Framing presets: extreme-wide, establishing, wide, full, medium, medium-close, close-up, extreme-close-up, two-shot, over-the-shoulder, pov, plus historical detail/conversation/follow/arrival/intro. Compose both subjects or foreground shoulder in artwork. SVG crops cannot generate genuine high/low/overhead or reverse perspective: supply alternate artwork and poses. The angle field records the intended perspective; Dutch renders actual roll. Extreme wide requires art composed with a distant subject.

For new Three.js scenes, `UmtoCamera.spatialPose({target,distance,azimuth,angle,elevation,roll})` computes real y-up geometry for eye-level, high, low, birds-eye, worms-eye, Dutch, OTS and POV (compose actual subjects with target and azimuth). `new UmtoCamera.SpatialCamera(threeCamera)` applies/interpolates poses. Animate azimuth for orbit, translate position and target for tracking/truck/crane, change distance for dolly, animate FOV or orthographic zoom for optical zoom, and use authored waypoints for fly-throughs. This adapter does not convert existing SVG scenes to 3D.

Little Panth 002 accepts optional `camera` on watch-mode shots and dialogue lines, and restores a wide frame for activities. Little Panth 001 accepts optional preset, focus and width on dialogue lines, using its existing smooth follow/reaction camera; it does not apply the shared controller's roll or timeline movements. Use the shared controller in new episodes.
