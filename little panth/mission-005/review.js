(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const statusNames = { pending: 'To review', approved: 'Approved', changes: 'Needs changes' };
  const time = ms => Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0');

  function createReview(data, scenes, revision, audio, player) {
    document.body.classList.add('reviewing');
    const template = $('review-ui').content.cloneNode(true);
    document.body.insertBefore(template.querySelector('.review-header'), $('shell'));
    $('shell').append(template);
    const mission = data.mission || 5;
    const number = String(mission).padStart(2, '0');
    const key = 'little-panth-' + number + '-review-' + revision;
    let entries = {};
    try { entries = JSON.parse(localStorage.getItem(key)) || {}; } catch {}

    const read = id => entries[id] || { decision: 'pending', note: '' };
    function save(id, change) {
      entries[id] = { ...read(id), ...change };
      try { localStorage.setItem(key, JSON.stringify(entries)); } catch {}
    }

    let selected = 0;
    let lastLine = '';
    let position = 0;
    let sceneFocus = null;
    const buttons = scenes.map((scene, i) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      const label = document.createElement('span');
      const status = document.createElement('span');
      button.type = 'button';
      button.dataset.scene = scene.id;
      label.textContent = (i + 1) + '. ' + scene.title;
      status.className = 'decision';
      button.append(label, status);
      button.addEventListener('click', () => player.select(i));
      li.append(button);
      $('review-scenes').append(li);
      return { button, status };
    });

    $('review-audio').textContent = audio.count + '/' + audio.total + ' voices · ' + audio.aligned + ' aligned';
    $('review-audio').title = audio.generatedScore ? 'Lyria instrumental score and original sound effects' : 'Instrumental score and original sound effects';
    function statuses() {
      let approved = 0;
      for (const [i, scene] of scenes.entries()) {
        const { decision } = read(scene.id);
        if (decision === 'approved') approved++;
        buttons[i].button.dataset.decision = decision;
        buttons[i].button.setAttribute('aria-current', i === selected ? 'step' : 'false');
        buttons[i].status.textContent = statusNames[decision];
      }
      $('review-progress').textContent = approved + ' of ' + scenes.length + ' approved';
      const { decision } = read(scenes[selected].id);
      $('approve-scene').setAttribute('aria-pressed', String(decision === 'approved'));
      $('change-scene').setAttribute('aria-pressed', String(decision === 'changes'));
    }

    function setDecision(decision) {
      const id = scenes[selected].id;
      const current = read(id);
      save(id, { decision: current.decision === decision ? 'pending' : decision, updatedAt: new Date().toISOString() });
      statuses();
    }

    $('watch-scene').addEventListener('click', () => player.toggle());
    $('rewind-scene').addEventListener('click', () => player.restart());
    $('scrub').addEventListener('input', event => player.seek(Number(event.target.value)));
    $('approve-scene').addEventListener('click', () => setDecision('approved'));
    $('change-scene').addEventListener('click', () => setDecision('changes'));
    $('review-note').addEventListener('input', event => save(scenes[selected].id, { note: event.target.value }));
    $('note-time').addEventListener('click', () => {
      const notes = $('review-note');
      notes.value += (notes.value && !notes.value.endsWith('\n') ? '\n' : '') + '[' + time(position) + '] ';
      save(scenes[selected].id, { note: notes.value });
      notes.focus();
    });
    $('download-review').addEventListener('click', () => {
      const documentReview = {
        mission,
        title: data.title,
        revision,
        approved: scenes.every(scene => read(scene.id).decision === 'approved'),
        scenes: scenes.map(scene => ({ id: scene.id, title: scene.title, ...read(scene.id) }))
      };
      const blob = new Blob([JSON.stringify(documentReview, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'little-panth-' + number + '-review.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    return {
      update(sceneIndex, ms, line, playing) {
        const scene = scenes[sceneIndex];
        selected = sceneIndex;
        position = ms;
        if (sceneFocus !== scene.id) {
          sceneFocus = scene.id;
          $('review-title').textContent = scene.title;
          $('review-check').textContent = scene.review;
          $('review-note').value = read(scene.id).note;
          $('scrub').max = Math.floor(scene.duration);
          statuses();
          const address = new URL(window.location.href);
          address.searchParams.set('scene', scene.id);
          if (address.href !== location.href) history.replaceState(null, '', address);
        }
        if (lastLine !== line.id) {
          lastLine = line.id;
          $('review-speaker').textContent = data.speakers?.[line.speaker] || (line.speaker === 'crow' ? 'Crow' : 'Narrator');
          $('review-dialogue').textContent = line.pa;
        }
        $('watch-scene').textContent = playing ? 'Pause' : 'Play scene';
        $('scrub').value = Math.floor(ms);
        $('clock').textContent = time(ms) + ' / ' + time(scene.duration);
      }
    };
  }

  window.createLP005Review = createReview;
})();
