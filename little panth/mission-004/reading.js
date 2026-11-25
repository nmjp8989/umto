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
  const limits = { spread: { max: 18 }, cinema: { max: 12 } };
  const readingCache = new WeakMap();

  function normalizeLayout(layout) {
    return layout === 'cinema' ? 'cinema' : 'spread';
  }

  function groupWords(words, timings, layout) {
    const { max } = limits[layout];
    const n = words.length;
    const sentenceEnds = [];
    for (let i = 1; i <= n; i++) {
      if (i === n || endsSentence(words[i - 1])) sentenceEnds.push(i);
    }
    // A full sentence is the smallest reading unit. Join adjacent complete
    // sentences when they fit the preferred size; never cut a long sentence
    // just to satisfy a word count. The view can fit long text in its panel.
    const phrases = [], phraseByWord = [];
    let first = 0, end = 0;
    function add(last) {
      const phrase = { first, end: last, text: words.slice(first, last).join(' '),
        startMs: timings[first][0], endMs: timings[last - 1][1] };
      for (let i = first; i < last; i++) phraseByWord[i] = phrases.length;
      phrases.push(phrase);
      first = last;
    }
    for (const boundary of sentenceEnds) {
      if (end > first && boundary - first > max) add(end);
      end = boundary;
      if (end - first >= max) add(end);
    }
    if (end > first) add(end);
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
