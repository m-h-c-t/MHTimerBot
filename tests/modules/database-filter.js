import test from 'tape';

import { DatabaseFilter } from '../../src/models/dbFilter.js';
import { getSearchedEntity } from '../../src/modules/search-helpers.js';

test('database filters - display labels and code names are searchable', suite => {
    const filters = [
        new DatabaseFilter('spring_event_2026', { display_name: 'Spring Festival 2026' }),
        new DatabaseFilter('all_time', { display_name: 'All Time' }),
    ];
    suite.plan(6);

    suite.equal(filters[0].value, 'Spring Festival 2026', 'uses display name as the user-facing value');
    suite.equal(filters[0].lowerValue, 'spring festival 2026 spring_event_2026', 'indexes display name and code');
    suite.equal(
        getSearchedEntity('spring festival', filters)[0].code_name,
        'spring_event_2026',
        'matches a display name',
    );
    suite.equal(
        getSearchedEntity('spring_event', filters)[0].code_name,
        'spring_event_2026',
        'matches a code name',
    );
    suite.equal(
        getSearchedEntity('all time', filters)[0].code_name,
        'all_time',
        'matches display names with spaces',
    );
    suite.equal(
        getSearchedEntity('ALL_TIME', filters)[0].code_name,
        'all_time',
        'matches codes case-insensitively',
    );
});

test('database filter search - returns multiple matching event filters', suite => {
    const filters = Array.from({ length: 9 }, (_, index) => {
        const year = 2018 + index;
        return new DatabaseFilter(`halloween_${year}`, {
            display_name: `Halloween ${year}`,
        });
    });
    const matches = getSearchedEntity('halloween', filters, 25);
    suite.plan(2);

    suite.equal(matches.length, 9, 'returns all matching filters instead of one match');
    suite.deepEqual(
        matches.map(filter => filter.code_name),
        filters.map(filter => filter.code_name),
        'returns every Halloween year in display-name order',
    );
});
