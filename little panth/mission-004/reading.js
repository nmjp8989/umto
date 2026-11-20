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

  function makeReading(text, durationMs, alignedWords) {
    const words = text.trim().split(/\s+/u);
    const timings = passage(words, durationMs, alignedWords);
    const phrases = [];
    const phraseByWord = [];
    let first = 0;
    for (let last = 1; last <= words.length; last++) {
      if (last < words.length && !endsSentence(words[last - 1])) continue;
      while (first < last) {
        const remaining = last - first;
        const ideal = Math.ceil(remaining / Math.ceil(remaining / 8));
        let end = first + ideal;
        if (remaining > 8) {
          for (let i = Math.min(first + 8, last - 3); i >= end - 1; i--) {
            if (!/[,;:][”’"']*$/u.test(words[i - 1])) continue;
            end = i;
            break;
          }
        }
        const phrase = {
          first,
          end,
          text: words.slice(first, end).join(' '),
          startMs: timings[first][0],
          endMs: timings[end - 1][1]
        };
        for (let i = first; i < end; i++) phraseByWord[i] = phrases.length;
        phrases.push(phrase);
        first = end;
      }
    }
    return { words, timings, phrases, phraseByWord };
  }

  function readingAt(reading, ms) {
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
