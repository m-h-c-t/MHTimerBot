import test from 'tape';

import { ensureGuildSettings } from '../../src/modules/guild-settings.js';

test('ensureGuildSettings creates defaults without announcement channels', t => {
    const settings = { botPrefix: ' -timer ' };

    const { guildSettings, changed } = ensureGuildSettings(settings, 'guild-1');

    t.ok(changed, 'reports that settings were added');
    t.equal(guildSettings.botPrefix, '-timer', 'uses the configured default prefix');
    t.deepEqual(guildSettings.timedAnnouncementChannels, new Set(), 'starts with no configured announcement channels');
    t.end();
});

test('ensureGuildSettings uses the standard prefix and empty channel list', t => {
    const { guildSettings } = ensureGuildSettings({}, 'guild-1');

    t.equal(guildSettings.botPrefix, '-mh', 'defaults to the standard prefix');
    t.deepEqual(guildSettings.timedAnnouncementChannels, new Set(), 'does not enable announcements before channel configuration');
    t.end();
});

test('ensureGuildSettings preserves existing configuration', t => {
    const existing = {
        botPrefix: '!mh',
        timedAnnouncementChannels: ['announcements'],
        adminrole: 'Admins',
    };
    const settings = { guilds: { 'guild-1': existing } };

    const { guildSettings, changed } = ensureGuildSettings(settings, 'guild-1');

    t.ok(changed, 'converts channel names into a Set');
    t.equal(guildSettings.botPrefix, '!mh', 'keeps the existing prefix');
    t.deepEqual(guildSettings.timedAnnouncementChannels, new Set(['announcements']), 'keeps existing channel names');
    t.equal(guildSettings.adminrole, 'Admins', 'keeps other existing settings');
    t.end();
});

test('ensureGuildSettings normalizes legacy channel formats', t => {
    const settings = {
        guilds: {
            'guild-1': { timedAnnouncementChannels: { announcements: true, alerts: true } },
            'guild-2': { timedAnnouncementChannels: null },
            'guild-3': { timedAnnouncementChannels: 'news, updates' },
        },
    };

    const objectFormat = ensureGuildSettings(settings, 'guild-1');
    const nullFormat = ensureGuildSettings(settings, 'guild-2');
    const stringFormat = ensureGuildSettings(settings, 'guild-3');

    t.deepEqual(objectFormat.guildSettings.timedAnnouncementChannels, new Set(['announcements', 'alerts']), 'uses keys from legacy object formats');
    t.deepEqual(nullFormat.guildSettings.timedAnnouncementChannels, new Set(), 'normalizes null values to an empty channel list');
    t.deepEqual(stringFormat.guildSettings.timedAnnouncementChannels, new Set(['news', 'updates']), 'splits and trims string formats');
    t.end();
});

test('ensureGuildSettings is idempotent and isolates guild defaults', t => {
    const settings = {};

    const first = ensureGuildSettings(settings, 'guild-1');
    const second = ensureGuildSettings(settings, 'guild-2');
    const repeated = ensureGuildSettings(settings, 'guild-1');

    t.notEqual(first.guildSettings, second.guildSettings, 'creates independent guild settings');
    t.notEqual(first.guildSettings.timedAnnouncementChannels, second.guildSettings.timedAnnouncementChannels, 'creates independent channel sets');
    t.notOk(repeated.changed, 'does not report changes when defaults already exist');
    t.end();
});

test('ensureGuildSettings rejects invalid guild settings', t => {
    t.throws(
        () => ensureGuildSettings({ guilds: { 'guild-1': null } }, 'guild-1'),
        /Invalid settings for guild guild-1/,
        'does not silently replace malformed settings',
    );
    t.throws(
        () => ensureGuildSettings({ guilds: { 'guild-1': { timedAnnouncementChannels: 42 } } }, 'guild-1'),
        /Invalid timed announcement channel settings/,
        'reports unsupported channel setting types',
    );
    t.end();
});
