/* The reader and video exporter share phrase boundaries and word timings. */
(function (root) {
  'use strict';

  function passage(words, durationMs, alignedWords) {
    if (alignedWords?.length === words.length) return alignedWords;

    // Give silent playback a pace when the audio or its alignment is unavailable.
    const weights = words.map(word => 1 + [...word].length * 0.13 + (endsSentence(word) ? 1 : 0));
    const unit = durationMs / weights.reduce((sum, weight) => sum + weight, 0);
    let start = 0;
    return weights.map(weight => {
      const end = start + weight * unit;
      const window = [start, end];
      start = end;
      return window;
    });
  }

  function endsSentence(word) {
    return /[।.!?][”’"']*$/u.test(word);
  }

  // The active layout determines the preferred amount of text. Each card
  // stays visible until the last word in it has been read.
  const limits = { spread: { target: 8, max: 10 }, cinema: { target: 6, max: 8 } };
  const readingCache = new WeakMap();

  function normalizeLayout(layout) {
    return layout === 'cinema' ? 'cinema' : 'spread';
  }

  // Avoid separating common Punjabi postpositions, particles and auxiliary
  // verbs from the preceding words when choosing a spoken clause boundary.
  const attached = new Set(['ਦਾ','ਦੀ','ਦੇ','ਦੀਆਂ','ਨੂੰ','ਨੇ','ਤੋਂ','ਵਿੱਚ','ਉੱਤੇ','ਤੇ','ਨਾਲ','ਵੱਲ','ਲਈ','ਕੋਲ','ਹੀ','ਵੀ','ਹੈ','ਹਨ','ਸੀ','ਸਨ','ਗਿਆ','ਗਈ','ਗਏ','ਗਈਆਂ','ਰਿਹਾ','ਰਹੀ','ਰਹੇ','ਸਕਦਾ','ਸਕਦੀ','ਸਕਦੇ','ਸਕੀਏ']);
  const clean = word => word.replace(/[\p{P}\p{S}]/gu, '');
  function groupWords(words, timings, layout) {
    const { target, max } = limits[layout];
    const n = words.length;
    const phrases = [], phraseByWord = [];
    function add(first, end) {
      const phrase = { first, end, text: words.slice(first, end).join(' '),
        startMs: timings[first][0], endMs: timings[end - 1][1] };
      for (let i = first; i < end; i++) phraseByWord[i] = phrases.length;
      phrases.push(phrase);
    }
    // Do not combine independent sentences on one card. Long sentences get
    // balanced, smaller spoken phrases, prioritizing punctuation and pauses.
    let sentenceStart = 0;
    for (let last = 1; last <= n; last++) {
      if (last !== n && !endsSentence(words[last - 1])) continue;
      const length = last - sentenceStart;
      if (length <= max) {
        add(sentenceStart, last);
      } else {
        const count = Math.ceil(length / max);
        const ideal = length / count;
        const costs = new Map(), choices = new Map();
        function best(first, left) {
          if (left === 0) return first === last ? 0 : Infinity;
          const key = first + ':' + left;
          if (costs.has(key)) return costs.get(key);
          let score = Infinity;
          const min = Math.min(3, Math.floor(length / count));
          for (let k = min; k <= Math.min(max, last - first); k++) {
            const boundary = first + k, remaining = last - boundary;
            if (remaining < (left - 1) * min || remaining > (left - 1) * max) continue;
            const tail = best(boundary, left - 1);
            if (!Number.isFinite(tail)) continue;
            let penalty = (k - ideal) ** 2 * .6 + Math.max(0, k - target) * .25;
            if (boundary < last) {
              const pause = timings[boundary][0] - timings[boundary - 1][1];
              penalty += /[,;:][”’"']*$/u.test(words[boundary - 1]) ? -5 :
                pause >= 180 ? -4 : 1;
              if (attached.has(clean(words[boundary]))) penalty += 7;
            }
            if (penalty + tail < score) {
              score = penalty + tail;
              choices.set(key, boundary);
            }
          }
          costs.set(key, score);
          return score;
        }
        best(sentenceStart, count);
        for (let first = sentenceStart, left = count; first < last; left--) {
          const boundary = choices.get(first + ':' + left) ?? Math.min(last, first + max);
          add(first, boundary);
          first = boundary;
        }
      }
      sentenceStart = last;
    }
    return { phrases, phraseByWord };
  }

  function makeReading(text, durationMs, alignedWords, layout = 'spread') {
    const words = text.trim().split(/\s+/u);
    const timings = passage(words, durationMs, alignedWords);
    const mode = normalizeLayout(layout);
    const groups = groupWords(words, timings, mode);
    const reading = { words, timings, ...groups };
    readingCache.set(reading, { mode, [mode]: groups });
    return reading;
  }

  function selectLayout(reading, layout) {
    const cache = readingCache.get(reading);
    const mode = normalizeLayout(layout ?? root.document?.getElementById('book')?.dataset.layout ?? cache?.mode);
    if (cache?.mode === mode) return;
    const next = cache || {};
    const groups = next[mode] || groupWords(reading.words, reading.timings, mode);
    next[mode] = groups;
    next.mode = mode;
    reading.phrases = groups.phrases;
    reading.phraseByWord = groups.phraseByWord;
    readingCache.set(reading, next);
  }

  function readingAt(reading, ms, layout) {
    selectLayout(reading, layout);
    let low = 0;
    let high = reading.timings.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (reading.timings[mid][0] <= ms) low = mid + 1;
      else high = mid;
    }
    const word = Math.max(0, low - 1);
    const active = ms >= reading.timings[word][0] && ms < reading.timings[word][1];
    return { phrase: reading.phraseByWord[word], word: active ? word : -1 };
  }

  // Fit only when a complete passage would exceed the existing reading area.
  // This does not change the recorded timings, camera, or normal font size.
  function installReadingFit() {
    const doc = root.document;
    const book = doc?.getElementById('book'), text = doc?.getElementById('reading');
    const panel = text?.closest('.reading-page');
    if (!book || !text || !panel || !root.MutationObserver) return;
    let queued = false;
    function fit() {
      queued = false;
      if (doc.body.classList.contains('reviewing')) {
        text.style.removeProperty('font-size');
        return;
      }
      text.style.removeProperty('font-size');
      const base = parseFloat(root.getComputedStyle(text).fontSize);
      if (!Number.isFinite(base) || !text.textContent.trim()) return;
      const style = root.getComputedStyle(panel);
      const cinema = book.dataset.layout === 'cinema';
      const movie = book.querySelector('.movie');
      const height = cinema
        ? Math.min(book.clientHeight * .28, (movie?.clientHeight || book.clientHeight) * .45)
        : panel.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (height <= 0 || !text.clientWidth) return;
      const fits = () => text.getBoundingClientRect().height <= height + 1 &&
        text.scrollWidth <= text.clientWidth + 1;
      if (fits()) return;
      let low = 8, high = base;
      for (let i = 0; i < 12; i++) {
        const size = (low + high) / 2;
        text.style.fontSize = size + 'px';
        if (fits()) low = size;
        else high = size;
      }
      text.style.fontSize = Math.floor(low * 10) / 10 + 'px';
    }
    function schedule() {
      if (queued) return;
      queued = true;
      root.requestAnimationFrame(fit);
    }
    // A new passage is a child-list change; the per-word highlight only
    // changes an attribute and must not trigger resizing.
    new root.MutationObserver(fit).observe(text, { childList: true });
    new root.MutationObserver(schedule).observe(book, { attributes: true, attributeFilter: ['data-layout'] });
    root.addEventListener('resize', schedule);
    doc.fonts?.ready?.then(schedule);
    schedule();
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', installReadingFit, { once: true });
    else installReadingFit();
  }

  const api = { makeReading, readingAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LP004Reading = api;
})(typeof window !== 'undefined' ? window : globalThis);
