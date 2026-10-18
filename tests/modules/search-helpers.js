import test from 'tape';

import { DatabaseFilter } from '../../src/models/dbFilter.js';
import { getSearchedEntity } from '../../src/modules/search-helpers.js';

test('getSearchedEntity with database filters', t => {
    const filters = [
        new DatabaseFilter('time_beta', {}),
        new DatabaseFilter('time_alpha', {}),
    ];

    const results = getSearchedEntity('time', filters);

    t.deepEqual(
        results.map(filter => filter.code_name),
        ['time_alpha', 'time_beta'],
        'sorts tied filter matches by their code name',
    );
    t.end();
});
