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
    // Display a full 12-word window whenever the recorded line contains
    // enough words. Sentence punctuation no longer forces a new card.
    // Keep the last window full by retaining already-read context.
    const maxWords = 12;
    const phrases = [];
    const phraseByWord = [];
    for (let activeFirst = 0; activeFirst < words.length; activeFirst += maxWords) {
      const end = Math.min(activeFirst + maxWords, words.length);
      const first = Math.max(0, end - maxWords);
      const phrase = {
        first,
        end,
        text: words.slice(first, end).join(' '),
        startMs: timings[activeFirst][0],
        endMs: timings[end - 1][1]
      };
      for (let i = activeFirst; i < end; i++) phraseByWord[i] = phrases.length;
      phrases.push(phrase);
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
