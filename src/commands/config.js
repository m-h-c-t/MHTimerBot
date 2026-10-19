// eslint-disable-next-line no-unused-vars
import { ChannelType, InteractionContextType, Message, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { CommandResult } from '../interfaces/command-result.js';
import { splitMessageRegex } from '../modules/format-utils.js';
import { Logger } from '../modules/logger.js';
import { checkPerms } from '../modules/security.js';
const usage = [
    'view - see current settings for this server',
    'modrole - define the role on this server for moderation level',
    'adminrole - define the role on this server for admin level',
    'prefix - change the prefix on this server',
    'timers [add|remove] [<channel>] - add or remove a channel to announce timers in',
    'emoji [remove] [<name>] - removes/unsets the emoji for this server or displays what it currently is',
    'emoji <name> <value> - sets an emoji for this server for that <name> such as power type emoji',
].join('\n\t');

/**
 *
 * @param {Message} message the message that triggered the command
 * @param {string[]} tokens tokenized arguments to the command
 * @returns {Promise<CommandResult>}
 */
async function doSet(message, tokens) {
    const theResult = new CommandResult({ message, success: false });
    const guild = message.guild;
    const guildSettings = message.client.settings.guilds[guild.id];
    let reply = '';
    if (!tokens.length)
        tokens = ['view'];
    const action = tokens.shift().toLowerCase();
    if (!checkPerms(message.member, 'admin')) {
        reply = 'Just who do you think you are?';
    }
    else if (action === 'view' && guild) {
        // Show current settings.
        reply = `\`adminrole\` - ${guildSettings.adminrole}\n`;
        reply += `\`modrole\` - ${guildSettings.modrole}`;
        if ('emoji' in guildSettings) {
            reply += '\nYou can see your emoji settings with `config emoji`';
        }
    }
    else if (guild && action === 'emoji') {
        // Allow setting for any string, really. But we especially want power types.
        reply = 'I don\'t know what to set here...';
        let guild_emojis = {};
        let action = 'add';
        if (tokens.length > 0) {
            if (tokens[0].toLowerCase() === 'remove') {
                action = 'remove';
                tokens.shift();
            }
        }
        if ('emoji' in guildSettings)
            guild_emojis = guildSettings['emoji'];
        if (tokens.length === 0) {
            // Show off what we have right now.
            const howMany = Object.keys(guild_emojis).length;
            reply = `Currently configured emoji (${howMany}):\n`;
            reply += Object.keys(guild_emojis).map(e => {
                return `${e} - ${guild_emojis[e]}`;
            }).join('\n');
        } else if (tokens.length === 1) {
            const emoji_name = tokens.shift().toLowerCase();
            const current_value = (emoji_name in guild_emojis ? guild_emojis[emoji_name] : 'nothing yet');
            if (action === 'remove') {
                if (current_value === 'nothing yet') {
                    reply = `${emoji_name} is not set and was not unset`;
                } else {
                    delete guild_emojis[emoji_name];
                    guildSettings['emoji'] = guild_emojis;
                    reply = `${emoji_name} was ${current_value}`;
                }
            } else {
                reply = `${emoji_name} is set to ${current_value}`;
            }
        } else if (tokens.length === 2) {
            const emoji_name = tokens.shift().toLowerCase();
            const set_to = tokens.shift();
            reply = `I set ${emoji_name} to ${set_to}`;
            guild_emojis[emoji_name] = set_to;
            guildSettings['emoji'] = guild_emojis;
        }
    }
    else if (action === 'modrole' || action === 'adminrole') {
        // Set the moderator role on this server.
        const newRole = tokens.shift();
        reply = `'${newRole}' not found in this guild.`;
        if (guild.available) {
            const roleKey = guild.roles.cache.findKey(r => r.name === newRole);
            const role = guild.roles.cache.get(roleKey);
            Logger.log(`Received ${role}`);
            if (role && role.name) {
                guildSettings[action] = role.name;
                reply = `${action} set to ${role.name}`;
            }
        }
        Logger.log(`Guild: ${guild.available}\nRole ${newRole}: ${guild.roles.cache.findKey(r => r.name === newRole)}`);
        Logger.log(`Roles: ${[...guild.roles.cache.values()]}`);
    }
    else if (action === 'timers') {
        const subAction = (tokens.length) ? tokens.shift().toLowerCase() : '';
        if (subAction === 'add') {
            // Next argument should be a channel reference, add it to the array of timer channels.
            const [channel] = Array.from(message.mentions.channels.values());
            if (!channel)
                reply = 'I don\'t think you gave me a channel to add';
            else if (channel.type !== ChannelType.GuildText)
                reply = `Didn't add ${channel.toString()} because "${channel.type}" is not a text channel`;
            else if (!('name' in channel))
                reply = `Didn't add ${channel.toString()} because it has no name`;
            else if (guildSettings.timedAnnouncementChannels.has(channel.name))
                reply = `Didn't add ${channel.toString()} because it's already in the list`;
            else {
                guildSettings.timedAnnouncementChannels.add(channel.name);
                reply = `I added ${channel.toString()} but because Aard is lazy it won't be used until next restart`;
                Logger.log(`CONFIG: Added channel ${channel.id} (${channel.name}) to timers for guild ${guild.id} (${guild.name})`);
            }
        }
        else if (subAction === 'remove') {
            // Next argument should be a channel reference, remove it from the array of timer channels.
            const [channel] = Array.from(message.mentions.channels.values());
            if (!channel)
                reply = 'I don\'t think you gave me a channel to remove';
            else if (!('name' in channel))
                reply = `Didn't remove ${channel.toString()} because I couldn't figure out its name`;
            else if (guildSettings.timedAnnouncementChannels.has(channel.name)) {
                guildSettings.timedAnnouncementChannels.delete(channel.name);
                reply = `Removed ${channel.toString()} but because Aard is lazy it won't stop being used until next restart`;
                Logger.log(`CONFIG: Removed channel ${channel.id} (${channel.name}) from timers for guild ${guild.id} (${guild.name})`);
            }
            else {
                reply = `I didn't remove ${channel.toString()} because it's not in use`;
            }
        }
        else {
            const timers = Array.from(guildSettings.timedAnnouncementChannels);
            reply = `Timer channels for this server: ${timers.join(', ')}`;
        }
    }
    else if (action === 'prefix') {
        if (tokens.length) {
            guildSettings.newBotPrefix = tokens.shift();
            reply = `New prefix for this server after the bot restarts: \`${guildSettings.newBotPrefix}\``;
        } else {
            reply = `Current prefix for this server: \`${guildSettings.botPrefix}\``;
            if (guildSettings.newBotPrefix) {
                reply += `\nAfter restart the prefix will be \`${guildSettings.newBotPrefix}\``;
            }
        }
    }
    if (reply) {
        try {
            for (const msg of splitMessageRegex(reply)) {
                await message.channel.send(msg);
            }
            theResult.replied = true;
            theResult.sentDm = message.channel.isDMBased();
            theResult.success = true;
        } catch (err) {
            Logger.error('CONFIG: failed to send reply', err);
            theResult.botError = true;
        }
    }
    return theResult;
}

/**
 * Execute a configuration slash command using the same settings logic as the prefix command.
 * @param {import('discord.js').CommandInteraction} interaction The command interaction
 */
async function interact(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    const isPublic = interaction.options.getBoolean('public') ?? false;
    const tokens = [];
    let channel;

    if (subcommand === 'adminrole' || subcommand === 'modrole') {
        tokens.push(subcommand, interaction.options.getRole('role').name);
    } else if (subcommand === 'prefix') {
        tokens.push('prefix');
        const prefix = interaction.options.getString('value');
        if (prefix) tokens.push(prefix);
    } else if (subcommand.startsWith('timers')) {
        tokens.push('timers');
        if (subcommand === 'timers-add' || subcommand === 'timers-remove') {
            tokens.push(subcommand.slice('timers-'.length));
            channel = interaction.options.getChannel('channel');
        }
    } else if (subcommand.startsWith('emoji')) {
        tokens.push('emoji');
        if (subcommand === 'emoji-get' || subcommand === 'emoji-set') {
            tokens.push(interaction.options.getString('name'));
            if (subcommand === 'emoji-set') tokens.push(interaction.options.getString('value'));
        } else if (subcommand === 'emoji-remove') {
            tokens.push('remove', interaction.options.getString('name'));
        }
    }

    const sentMessages = [];
    const message = {
        guild: interaction.guild,
        member: interaction.member,
        client: interaction.client,
        channel: {
            send: async content => sentMessages.push(content),
            isDMBased: () => false,
        },
        mentions: {
            channels: {
                values: () => (channel ? [channel] : []).values(),
            },
        },
    };

    await doSet(message, tokens);
    if (!sentMessages.length) return;

    await interaction.reply({
        content: sentMessages[0],
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
    });
    for (const content of sentMessages.slice(1)) {
        await interaction.followUp({
            content,
            flags: isPublic ? undefined : MessageFlags.Ephemeral,
        });
    }
}

function addPublicOption(subcommand) {
    return subcommand.addBooleanOption(option =>
        option.setName('public')
            .setDescription('Show the response publicly')
            .setRequired(false));
}

const slashCommand = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure settings for this server')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('view')
            .setDescription('View server settings')))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('adminrole')
            .setDescription('Set the server admin role')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('Role to grant admin access')
                    .setRequired(true))))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('modrole')
            .setDescription('Set the server moderator role')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('Role to grant moderator access')
                    .setRequired(true))))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('prefix')
            .setDescription('View or set the server command prefix')
            .addStringOption(option =>
                option.setName('value')
                    .setDescription('New prefix, applied after the bot restarts')
                    .setRequired(false))))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('timers')
            .setDescription('List timer announcement channels')))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('timers-add')
            .setDescription('Add a timer announcement channel')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Text channel to add')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true))))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('timers-remove')
            .setDescription('Remove a timer announcement channel')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Text channel to remove')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true))))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('emoji')
            .setDescription('List configured server emoji')))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('emoji-get')
            .setDescription('View a configured emoji')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('Emoji setting name')
                    .setRequired(true))))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('emoji-set')
            .setDescription('Set a server emoji')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('Emoji setting name')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('value')
                    .setDescription('Emoji value')
                    .setRequired(true))))
    .addSubcommand(subcommand =>
        addPublicOption(subcommand.setName('emoji-remove')
            .setDescription('Remove a configured emoji')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('Emoji setting name')
                    .setRequired(true))));

export const command = {
    name: 'config',
    requiresArgs: true,
    usage: usage,
    description: 'Configure settings per server',
    execute: doSet,
    minPerm: 'admin',
    canDM: false,
    slashCommand,
    interactionHandler: interact,
};
