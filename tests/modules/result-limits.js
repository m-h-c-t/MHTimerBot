import test from 'tape';

import { limitPublicResults } from '../../src/modules/result-limits.js';

test('limitPublicResults preserves up to ten results', t => {
    const results = Array.from({ length: 10 }, (_, index) => index);
    const limited = limitPublicResults(results);

    t.deepEqual(limited.results, results, 'returns all ten results');
    t.notOk(limited.truncated, 'does not mark complete results as truncated');
    t.end();
});

test('limitPublicResults includes an exact eleventh result', t => {
    const results = Array.from({ length: 11 }, (_, index) => index);
    const limited = limitPublicResults(results);

    t.deepEqual(limited.results, results, 'returns all eleven results');
    t.notOk(limited.truncated, 'does not mark the exact eleven-result case as truncated');
    t.end();
});

test('limitPublicResults truncates longer lists to ten results', t => {
    const results = Array.from({ length: 12 }, (_, index) => index);
    const limited = limitPublicResults(results);

    t.deepEqual(limited.results, results.slice(0, 10), 'returns only the first ten results');
    t.ok(limited.truncated, 'marks the result list as truncated');
    t.end();
});
