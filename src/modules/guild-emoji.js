/**
 * Get the effective emoji configuration for a guild.
 * Guild-specific values override bot-wide defaults.
 * @param {object} settings The bot settings.
 * @param {string|null} guildId The guild ID, or null outside a guild.
 * @returns {object}
 */
export function getGuildEmoji(settings, guildId = null) {
    const defaults = settings.bot_emoji ?? {};
    const overrides = guildId ? settings.guilds?.[guildId]?.emoji ?? {} : {};
    return { ...defaults, ...overrides };
}
