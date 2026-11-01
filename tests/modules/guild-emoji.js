import test from 'tape';

import { getGuildEmoji } from '../../src/modules/guild-emoji.js';

test('getGuildEmoji uses bot-wide defaults', t => {
    const defaults = { arcane: '<:arcane:123>', sb: '<:sb:456>' };
    const settings = { bot_emoji: defaults, guilds: {} };

    t.deepEqual(getGuildEmoji(settings, 'guild-1'), defaults, 'returns global emoji for an unconfigured guild');
    t.deepEqual(getGuildEmoji(settings), defaults, 'returns global emoji outside a guild');
    t.end();
});

test('getGuildEmoji lets guild emoji override bot-wide defaults', t => {
    const settings = {
        bot_emoji: { arcane: '<:default:123>', draconic: '<:draconic:456>' },
        guilds: {
            'guild-1': {
                emoji: { arcane: '<:custom:789>' },
            },
        },
    };

    t.deepEqual(
        getGuildEmoji(settings, 'guild-1'),
        { arcane: '<:custom:789>', draconic: '<:draconic:456>' },
        'preserves default emoji not overridden by the guild',
    );
    t.end();
});

test('getGuildEmoji safely handles missing emoji settings', t => {
    t.deepEqual(getGuildEmoji({}, 'guild-1'), {}, 'returns an empty mapping when no emoji are configured');
    t.end();
});
