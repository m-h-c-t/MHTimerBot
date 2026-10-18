// eslint-disable-next-line no-unused-vars
import { Message, MessageFlags, CommandInteraction, SlashCommandBuilder } from 'discord.js';

import { CommandResult } from '../interfaces/command-result.js';
import { splitMessageRegex } from '../modules/format-utils.js';
import { Logger } from '../modules/logger.js';
import { extractEventFilter, getLoot, formatLoot,
    sendInteractiveSearchResult, listFilters, getMice, formatMice, getFilter } from '../modules/mhct-lookup.js';

/**
 *
 * @param {Message} message The message that triggered the action
 * @param {string[]} userArgs The tokens of the command
 * @returns {Promise<CommandResult>} Status of the execution
 */
async function doIFIND(message, userArgs) {
    const theResult = new CommandResult({ message, success: false, sentDM: false });
    let reply = '';
    const opts = {};
    const urlInfo = {
        qsParams: {},
        uri: 'https://www.mhct.win/loot.php',
        type: 'item',
    };
    if (!userArgs)
        reply = 'I just cannot find what you\'re looking for (since you didn\'t tell me what it was).';
    else {
        const { tokens, filter } = extractEventFilter(userArgs);
        // Set the filter if it's requested.
        if (filter) {
            opts.timefilter = filter.code_name;
        }

        // Figure out what they're searching for (remove mouse at the end in case of fallthrough)
        if (tokens[tokens.length - 1].toLowerCase() === 'mouse') {
            tokens.pop();
        }
        const searchString = tokens.join(' ').toLowerCase();
        // TODO: When I put the reaction menu back it goes here
        const all_loot = getLoot(searchString, message.client.nicknames.get('loot'));
        if (all_loot && all_loot.length) {
            // We have multiple options, show the interactive menu
            urlInfo.qsParams = opts;
            sendInteractiveSearchResult(all_loot, message.channel, formatLoot,
                message.channel.isDMBased(), urlInfo, searchString);
            theResult.replied = true;
            theResult.success = true;
            theResult.sentDM = message.channel.isDMBased();
        } else {
            const all_mice = getMice(searchString, message.client.nicknames.get('mice'));
            if (all_mice && all_mice.length) {
                // We have multiple options, show the interactive menu
                urlInfo.qsParams = opts;
                urlInfo.type = 'mouse';
                urlInfo.uri = 'https://www.mhct.win/attractions.php';
                sendInteractiveSearchResult(all_mice, message.channel, formatMice,
                    message.channel.isDMBased(), urlInfo, searchString);
                theResult.replied = true;
                theResult.success = true;
                theResult.sentDM = message.channel.isDMBased();
            } else {
                reply = `I don't know anything about "${searchString}"`;
            }
        }
    }
    if (reply) {
        try {
            // Note that a lot of this is handled by sendInteractiveSearchResult
            for (const msg of splitMessageRegex(reply, { prepend: '```\n', append: '\n```' })) {
                await message.channel.send(msg);
            }
            theResult.replied = true;
            theResult.success = true;
            theResult.sentDM = message.channel.isDMBased();
        } catch (err) {
            Logger.error('IFIND: failed to send reply', err);
            theResult.botError = true;
        }
    }
    return theResult;
}

function helpFind() {
    let reply = '-mh ifind [-e filter] loot:\nFind the drop rates for loot (nicknames allowed, filters optional).\n';
    reply += 'Known filters: `current`, ' + listFilters();
    return reply;
}

/**
 * Reply to an autocomplete request.
 * @param {CommandInteraction} interaction Must be an autocomplete interaction
 */
async function autotype(interaction) {
    if (!interaction.isAutocomplete()) return;

    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'loot') {
        const choices = getLoot(focusedOption.value, interaction.client.nicknames.get('loot')) || [];
        await interaction.respond(
            choices.slice(0, 25).map(loot => ({ name: loot.value, value: loot.value })),
        );
    } else if (focusedOption.name === 'filter') {
        const filter = getFilter(focusedOption.value);
        await interaction.respond(
            filter ? [{
                name: filter.display_name || filter.code_name,
                value: filter.code_name,
            }] : [],
        );
    }
}

/**
 * Reply to a slash command.
 * @param {CommandInteraction} interaction The command interaction
 */
async function interact(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const isPublic = interaction.options.getBoolean('public') ?? false;
    await interaction.deferReply({
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
    });
    const searchString = interaction.options.getString('loot');
    const allLoot = getLoot(searchString, interaction.client.nicknames.get('loot'));
    if (!allLoot || !allLoot.length) {
        await interaction.editReply({ content: `Your search for '${searchString}' was not a success...` });
        return;
    }

    const requestedFilter = interaction.options.getString('filter');
    const results = await formatLoot(!isPublic, allLoot[0], {
        timefilter: getFilter(requestedFilter)?.code_name || 'all_time',
    });
    const pages = splitMessageRegex(results, { maxLength: 1800, prepend: '```', append: '```' });
    await interaction.editReply({ content: pages[0] });
    for (const page of pages.slice(1)) {
        await interaction.followUp({
            content: page,
            flags: isPublic ? undefined : MessageFlags.Ephemeral,
        });
    }
}

const slashCommand = new SlashCommandBuilder()
    .setName('find-loot')
    .setDescription('Get the drop rates for a loot item')
    .addStringOption(option =>
        option.setName('loot')
            .setDescription('The loot item to look up')
            .setRequired(true)
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('filter')
            .setDescription('The event period to look up (Default: all time)')
            .setRequired(false)
            .setAutocomplete(true))
    .addBooleanOption(option =>
        option.setName('public')
            .setDescription('Show the response publicly (limited to 10 results)')
            .setRequired(false));

// Initialize and save are in find.js.
export const command = {
    name: 'find-loot',
    args: true,
    usage: 'Coming Soon',
    description: 'Find items sorted by their drop rates',
    canDM: true,
    helpFunction: helpFind,
    aliases: ['ifind'],
    slashCommand,
    autocompleteHandler: autotype,
    interactionHandler: interact,
    execute: doIFIND,
};
