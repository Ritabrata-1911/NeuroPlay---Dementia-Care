// answerMatch.js
// -----------------------------------------------------------------------------
// Fuzzy answer checking for typed AND voice answers (elder-friendly, forgiving).
//
//  - normalizes case, spacing, punctuation and accents
//  - drops small filler words so voice phrases like "it is a japi" still match
//  - accepts any of an object's `accepted` answers (canonical + local spellings)
//  - tolerates small typos / mishearings via Levenshtein distance
// -----------------------------------------------------------------------------

const FILLER = new Set(['the', 'a', 'an', 'is', 'it', 'this', 'that', 'its', 'of', 'i', 'think']);

export function normalize(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ') // drop punctuation
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(' ')
    .trim();
}

// Classic Levenshtein edit distance between two strings.
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// How many edits we forgive, scaled to the length of the target word.
function tolerance(len) {
  if (len <= 4) return 1;
  if (len <= 7) return 2;
  return 3;
}

// Returns { correct, matched } where `matched` is the accepted answer that hit.
export function checkAnswer(userAnswer, acceptedAnswers = []) {
  const user = normalize(userAnswer);
  if (!user) return { correct: false, matched: null };

  const userTokens = user.split(' ').filter(Boolean);

  for (const answer of acceptedAnswers) {
    const target = normalize(answer);
    if (!target) continue;

    // 1. Exact (normalized) match.
    if (user === target) return { correct: true, matched: answer };

    // 2. Containment — voice input often adds extra words around the answer.
    if (target.length >= 4 && (user.includes(target) || target.includes(user))) {
      return { correct: true, matched: answer };
    }

    // 3. Whole-phrase fuzzy match (handles typos / mishearings).
    if (levenshtein(user, target) <= tolerance(target.length)) {
      return { correct: true, matched: answer };
    }

    // 4. For single-word answers, fuzzy-match any spoken/typed word.
    if (!target.includes(' ')) {
      const tol = tolerance(target.length);
      for (const token of userTokens) {
        if (token.length >= 3 && levenshtein(token, target) <= tol) {
          return { correct: true, matched: answer };
        }
      }
    }
  }

  return { correct: false, matched: null };
}