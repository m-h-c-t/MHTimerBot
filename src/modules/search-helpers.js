const fuzzysort = require('fuzzysort');

/**
 * Return a sorted list of approximate matches to the given input and container
 *
 * @param {string} input The text to match against
 * @param {Array<{ value: string, lowerValue: string, [x: string]: any }>} values An array of objects with a lowerValue property.
 * @returns {Array<{ value: string, [x: string]: any }>} Up to 10 values, sorted descending by their similarity to the input.
 */
function getSearchedEntity(input, values) {
    if (!input.length || !Array.isArray(values) || !values.length) {
        return [];
    }
    const lowered = input.toLowerCase();
    const matches = values.filter((v) => v.lowerValue.includes(lowered))
        .map((v) => ({
            entity: v,
            score: v.lowerValue.indexOf(lowered),
        }));
    matches.sort((a, b) => {
        const r = a.score - b.score;
        // Sort lexicographically if the scores are equal.
        return r ? r : a.entity.value.localeCompare(b.entity.value, { sensitivity: 'base' });
    });
    // Keep only the top 10 results.
    matches.splice(10);
    return matches.map(m => m.entity);
}

/**
 * Perform a fuzzy search on the given values using the input string.
 * @param {string} input The input string to search for.
 * @param {object} values The array of strings to search within.
 * @param {string} key The key to search within each object.
 * @returns {Fuzzysort.KeyResults<any>} The array of up to ten matching strings.
 */
function fuzzySearch(input, values, key) {
    if (!input.length || !Array.isArray(values) || !values.length) {
        return [];
    }

    const results = fuzzysort.go(input, values, { key: key });

    return results.slice(0, 10);
}

module.exports = {
    getSearchedEntity,
    fuzzySearch,
};
