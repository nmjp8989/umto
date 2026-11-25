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
  const limits = { spread: { min: 12, max: 18, floor: 7 },
    cinema: { min: 8, max: 12, floor: 5 } };
  const readingCache = new WeakMap();

  function normalizeLayout(layout) {
    return layout === 'cinema' ? 'cinema' : 'spread';
  }

  function groupWords(words, timings, layout) {
    const { min, max, floor } = limits[layout];
    const n = words.length;
    const costs = Array(n + 1).fill(Infinity), ends = Array(n);
    costs[n] = 0;
    // Find a natural partition of the recorded line, avoiding tiny leftovers.
    // Favor complete sentences, then clause punctuation or a recorded pause.
    for (let first = n - 1; first >= 0; first--) {
      for (let count = 1; count <= Math.min(max, n - first); count++) {
        const end = first + count;
        if (n > max && count < floor) continue;
        if (!Number.isFinite(costs[end])) continue;
        const short = Math.max(0, min - count);
        const punctuation = words[end - 1];
        const pause = end < n ? timings[end][0] - timings[end - 1][1] : 0;
        const breakCost = end === n || endsSentence(punctuation) ? 0 :
          /[,;:][”’"']*$/u.test(punctuation) || pause >= 160 ? 2 : 7;
        const cost = 2 + short * 1.7 + breakCost + costs[end];
        if (cost < costs[first] || (cost === costs[first] && end > ends[first])) {
          costs[first] = cost;
          ends[first] = end;
        }
      }
    }
    const phrases = [], phraseByWord = [];
    for (let first = 0; first < n;) {
      const end = ends[first] ?? Math.min(n, first + max);
      const phrase = { first, end, text: words.slice(first, end).join(' '),
        startMs: timings[first][0], endMs: timings[end - 1][1] };
      for (let i = first; i < end; i++) phraseByWord[i] = phrases.length;
      phrases.push(phrase);
      first = end;
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

  const api = { makeReading, readingAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LP004Reading = api;
})(typeof window !== 'undefined' ? window : globalThis);
