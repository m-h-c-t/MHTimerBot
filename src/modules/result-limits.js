/**
 * Apply the public-response list limit while preserving an exact 11-result list.
 * @template T
 * @param {T[]} results The complete result list.
 * @param {number} [limit] The normal public limit.
 * @returns {{ results: T[], truncated: boolean }}
 */
export function limitPublicResults(results, limit = 10) {
    if (results.length === limit + 1) {
        return { results, truncated: false };
    }

    return {
        results: results.slice(0, limit),
        truncated: results.length > limit + 1,
    };
}
