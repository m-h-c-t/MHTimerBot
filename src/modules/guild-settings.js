/**
 * Convert supported persisted channel formats to a Set.
 * @param {unknown} channels The configured channel names.
 * @returns {Set<string>}
 */
function toChannelSet(channels) {
    if (channels == null) {
        return new Set();
    }
    if (channels instanceof Set) {
        return channels;
    }
    if (Array.isArray(channels)) {
        return new Set(channels);
    }
    if (typeof channels === 'string') {
        return new Set(channels.split(',').map(channel => channel.trim()).filter(Boolean));
    }
    if (typeof channels === 'object') {
        return new Set(Object.keys(channels));
    }
    throw new TypeError('Invalid timed announcement channel settings');
}

/**
 * Ensure a guild has usable settings without replacing any existing values.
 * @param {object} settings The bot's global settings.
 * @param {string} guildId The Discord guild ID.
 * @returns {{ guildSettings: object, changed: boolean }}
 */
export function ensureGuildSettings(settings, guildId) {
    settings.guilds ??= {};
    let changed = false;
    let guildSettings = settings.guilds[guildId];

    if (guildSettings === undefined) {
        guildSettings = {};
        settings.guilds[guildId] = guildSettings;
        changed = true;
    } else if (guildSettings === null || typeof guildSettings !== 'object' || Array.isArray(guildSettings)) {
        throw new TypeError(`Invalid settings for guild ${guildId}`);
    }

    if (guildSettings.botPrefix === undefined) {
        guildSettings.botPrefix = settings.botPrefix?.trim() || '-mh';
        changed = true;
    }

    if (guildSettings.timedAnnouncementChannels === undefined) {
        guildSettings.timedAnnouncementChannels = new Set();
        changed = true;
    } else if (!(guildSettings.timedAnnouncementChannels instanceof Set)) {
        guildSettings.timedAnnouncementChannels = toChannelSet(guildSettings.timedAnnouncementChannels);
        changed = true;
    }

    return { guildSettings, changed };
}
