// eslint-disable-next-line no-unused-vars
import { Message, MessageFlags, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';

import { CommandResult } from '../interfaces/command-result.js';
import { Logger } from '../modules/logger.js';
import { initialize, extractEventFilter, getMice, formatMice, sendInteractiveSearchResult,
    listFilters, getLoot, formatLoot, save, getFilter } from '../modules/mhct-lookup.js';
import { splitMessageRegex } from '../modules/format-utils.js';

/**
 *
 * @param {Message} message The message that triggered the action
 * @param {string[]} userArgs The tokens of the command
 * @returns {Promise<CommandResult>} Status of the execution
 */
async function doFIND(message, userArgs) {
    const theResult = new CommandResult({ message, success: false, sentDM: false });
    let reply = '';
    const opts = {};
    const urlInfo = {
        qsParams: {},
        uri: 'https://www.mhct.win/attractions.php',
        type: 'mouse',
    };
    if (!userArgs)
        reply = 'I just cannot find what you\'re looking for (since you didn\'t tell me what it was).';
    else {
        const { tokens, filter } = extractEventFilter(userArgs);
        // Set the filter if it's requested.
        if (filter) {
            opts.timefilter = filter.code_name;
        }

        // Figure out what they're searching for.
        if (tokens[tokens.length - 1].toLowerCase() === 'mouse') {
            tokens.pop();
        }
        const searchString = tokens.join(' ').toLowerCase();
        if (isRelicHunterSearch(searchString)) {
            if (typeof message.client.findRelicHunter !== 'function') {
                Logger.error('FIND: Relic Hunter lookup is unavailable');
                theResult.botError = true;
                return theResult;
            }
            try {
                await message.channel.send(await message.client.findRelicHunter());
                theResult.replied = true;
                theResult.success = true;
                theResult.sentDM = message.channel.isDMBased();
            } catch (err) {
                Logger.error('FIND: failed to find the Relic Hunter', err);
                theResult.botError = true;
            }
            return theResult;
        } else {
            const all_mice = getMice(searchString, message.client.nicknames.get('mice'));
            if (all_mice && all_mice.length) {
                // We have multiple options, show the interactive menu.
                urlInfo.qsParams = opts;
                sendInteractiveSearchResult(all_mice, message.channel, formatMice,
                    message.channel.isDMBased(), urlInfo, searchString);
                theResult.replied = true;
                theResult.success = true;
                theResult.sentDM = message.channel.isDMBased();
            } else {
                const all_loot = getLoot(searchString, message.client.nicknames.get('loot'));
                if (all_loot && all_loot.length) {
                    // We have multiple options, show the interactive menu.
                    urlInfo.qsParams = opts;
                    urlInfo.type = 'item';
                    urlInfo.uri = 'https://www.mhct.win/loot.php';
                    sendInteractiveSearchResult(all_loot, message.channel, formatLoot,
                        message.channel.isDMBased(), urlInfo, searchString);
                    theResult.replied = true;
                    theResult.success = true;
                    theResult.sentDM = message.channel.isDMBased();
                } else {
                    reply = `I don't know anything about "${searchString}"`;
                }
            }
        }
    }
    if (reply) {
        try {
            // Note that a lot of this is handled by sendInteractiveSearchResult.
            for (const msg of splitMessageRegex(reply, { prepend: '```\n', append: '\n```' })) {
                await message.channel.send(msg);
            }
            theResult.replied = true;
            theResult.success = true;
            theResult.sentDM = message.channel.isDMBased();
        } catch (err) {
            Logger.error('FIND: failed to send reply', err);
            theResult.botError = true;
        }
    }
    return theResult;
}

function isRelicHunterSearch(searchString) {
    const tokens = searchString.trim().toLowerCase().split(/\s+/);
    if (tokens[tokens.length - 1] === 'mouse') {
        tokens.pop();
    }
    return ['rh', 'relic_hunter', 'relic hunter'].includes(tokens.join(' '));
}

function helpFind() {
    let reply = '-mh find [filter] mouse:\nFind the attraction rates for a mouse (nicknames allowed, filters optional).\n';
    reply += 'Known filters: `current`, ' + listFilters();
    return reply;
}

/**
 * Reply to an autotype request. Technically this could be folded into the interact?
 * @param {CommandInteraction} interaction Must be an autocomplete interaction
 */
async function autotype(interaction) {
    if (interaction.isAutocomplete()) {
        const focusedOption = interaction.options.getFocused(true);
        // let choices = [];
        if (focusedOption.name === 'mouse') {
            const searchString = focusedOption.value.trim().toLowerCase();
            const choices = getMice(focusedOption.value, interaction.client.nicknames.get('mice')) || [];
            if (searchString && ['rh', 'relic hunter', 'relic_hunter'].some(alias =>
                alias.startsWith(searchString) || searchString.startsWith(alias))) {
                choices.push({ value: 'Relic Hunter' });
            }
            if (choices.length) {
                await interaction.respond(
                    choices.slice(0, 25).map(mouse => ({ name: mouse.value, value: mouse.value })),
                );
            }
        }
        else if (focusedOption.name === 'filter') {
            const filter = getFilter(focusedOption.value || '');
            const choices = filter ? [filter] : [];
            await interaction.respond(
                choices.map(filter => ({
                    name: filter.display_name || filter.code_name,
                    value: filter.code_name,
                })),
            );
        }
    }
}

/**
 * Reply to an interaction
 * @param {CommandInteraction} interaction -- the thing to respond to
 */
async function interact(interaction) {
    if (interaction.isChatInputCommand()) {
        const isPublic = interaction.options.getBoolean('public') ?? false;
        await interaction.deferReply({
            flags: isPublic ? undefined : MessageFlags.Ephemeral,
        });
        const search_string = interaction.options.getString('mouse');
        if (isRelicHunterSearch(search_string)) {
            if (typeof interaction.client.findRelicHunter !== 'function') {
                Logger.error('FIND-MOUSE: Relic Hunter lookup is unavailable');
                await interaction.editReply({ content: 'The Relic Hunter lookup is unavailable.' });
                return;
            }
            await interaction.editReply({ content: await interaction.client.findRelicHunter() });
            return;
        }
        const all_mice = getMice(search_string);
        // let results = 'Somehow you did not search for a mouse'; // also happens when no matching mouse
        if (all_mice && all_mice.length) {
            const mouse = all_mice[0];
            const results = await formatMice(!isPublic, mouse, { timefilter: interaction.options.getString('filter') || 'all_time' });
            // Here we need to split the results into chunks. The button goes on the last chunk?
            const result_pages = splitMessageRegex(results, { maxLength: 1800, prepend: '```', append: '```' });
            await interactionDisplayPage(interaction, result_pages, 0);
        } else {
            // TODO: Figure out how to see what was provided when it didn't match a mouse...
            await interaction.editReply({ content: `Your search for '${search_string}' was not a success...` });
        }
    } else {
        Logger.error('Somehow find-mouse command interaction was called without a mouse');
    }
}

async function interactionDisplayPage(interaction, pages, current_page) {
    if (interaction.id && interaction.isChatInputCommand() && pages.length) {
        const isPublic = interaction.options.getBoolean('public') ?? false;
        current_page = current_page || 0;
        let buttons;
        if (pages.length > current_page + 1) {
            buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
                .setCustomId(`fmmore_${interaction.id}_${current_page}`)
                .setLabel('More Results')
                .setStyle(ButtonStyle.Primary));
        }
        if (buttons) {
            const filter = f => f.customId === `fmmore_${interaction.id}_${current_page}`
                && f.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 1 * 60 * 1000 });
            collector.on('collect', async c => {
                await interactionDisplayPage(interaction, pages, current_page+1);
                await c.update({ content: pages[current_page], components: [buttons] })
                    .catch((error) => Logger.error(error));
            });
            collector.on('end', async () => {
                await interaction.editReply({ content: pages[current_page], components: [] })
                    .catch(e => {
                        Logger.error(`FIND-MOUSE: ${e}`);
                    });
            });
        }
        // Send message
        if (current_page === 0) {
            await interaction.editReply({ content: pages[current_page], components: buttons ? [buttons] : [] });
        } else {
            await interaction.followUp({
                content: pages[current_page],
                flags: isPublic ? undefined : MessageFlags.Ephemeral,
                components: buttons ? [buttons] : [],
            });
        }
    }
}

// Build the slashcommand usage and things
const slashCommand = new SlashCommandBuilder()
    .setName('find-mouse')
    .setDescription('Get the attraction rates for a mouse')
    .addStringOption(option =>
        option.setName('mouse')
            .setDescription('The mouse to look up')
            .setRequired(true)
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('filter')
            .setDescription('The specific power type to look up (Default: all)')
            .setRequired(false)
            .setAutocomplete(true))
    .addBooleanOption(option =>
        option.setName('public')
            .setDescription('Show the response publicly (limited to 10 results)')
            .setRequired(false));

export const command = {
    name: 'find-mouse',
    args: true,
    usage: 'Coming Soon',
    helpFunction: helpFind,
    description: 'Find mice sorted by their attraction rates',
    canDM: true,
    aliases: ['mfind', 'find'],
    slashCommand: slashCommand,
    autocompleteHandler: autotype,
    interactionHandler: interact,
    execute: doFIND,
    initialize: initialize,
    save: save,
};
