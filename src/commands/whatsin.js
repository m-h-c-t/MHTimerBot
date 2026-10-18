// eslint-disable-next-line no-unused-vars
import { Message, MessageFlags, CommandInteraction, SlashCommandBuilder } from 'discord.js';

import { CommandResult } from '../interfaces/command-result.js';
import { Logger } from '../modules/logger.js';
import { initialize, getConvertibles, sendInteractiveSearchResult,
    save, formatConvertibles } from '../modules/mhct-lookup.js';
import { splitMessageRegex } from '../modules/format-utils.js';

const usage = [
    '<convertible> will report stats about what is inside that convertible',
    'Example: `whatsin gilded charm` will show how much SUPER|Brie+ comes out of gilded charms, on average',
    'See Also: find; for finding mice. ifind; for finding loot drops.',
].join('\n\t');

/**
 *
 * @param {Message} message The message that triggered the action
 * @param {string[]} tokens The tokens of the command
 * @returns {Promise<CommandResult>} Status of the execution
 */
async function doWHATSIN(message, tokens) {
    const theResult = new CommandResult({ message, success: false, sentDM: false });
    let reply = '';
    const opts = {};
    const urlInfo = {
        qsParams: {},
        uri: 'https://www.mhct.win/converter.php',
        type: 'item',
    };
    if (!tokens)
        reply = 'I just cannot find what you\'re looking for (since you didn\'t tell me what it was).';
    else {
        const searchString = tokens.join(' ').toLowerCase();
        const all_convertibles = getConvertibles(searchString);
        if (all_convertibles && all_convertibles.length) {
            // We have multiple options, show the interactive menu.
            urlInfo.qsParams = opts;
            sendInteractiveSearchResult(all_convertibles, message.channel, formatConvertibles,
                message.channel.isDMBased(), urlInfo, searchString);
            theResult.replied = true;
            theResult.success = true;
            theResult.sentDM = message.channel.isDMBased();
        } else {
            reply = `I don't know anything about "${searchString}"`;
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
            Logger.error('WHATSIN: failed to send reply', err);
            theResult.botError = true;
        }
    }
    return theResult;
}

/**
 * Reply to an autocomplete request.
 * @param {CommandInteraction} interaction Must be an autocomplete interaction
 */
async function autotype(interaction) {
    if (!interaction.isAutocomplete()) return;

    const searchString = interaction.options.getFocused();
    const convertibles = getConvertibles(searchString) || [];
    await interaction.respond(
        convertibles.slice(0, 25).map(convertible => ({
            name: convertible.value,
            value: convertible.value,
        })),
    );
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
    const searchString = interaction.options.getString('convertible');
    const convertibles = getConvertibles(searchString);
    if (!convertibles || !convertibles.length) {
        await interaction.editReply({
            content: `I don't know anything about "${searchString}"`,
        });
        return;
    }

    const results = await formatConvertibles(!isPublic, convertibles[0], {});
    const pages = splitMessageRegex(results, {
        maxLength: 1800,
        prepend: '```\n',
        append: '\n```',
    });
    await interaction.editReply({ content: pages[0] });
    for (const page of pages.slice(1)) {
        await interaction.followUp({
            content: page,
            flags: isPublic ? undefined : MessageFlags.Ephemeral,
        });
    }
}

const slashCommand = new SlashCommandBuilder()
    .setName('whatsin')
    .setDescription('See what items can come from a convertible')
    .addStringOption(option =>
        option.setName('convertible')
            .setDescription('The convertible to look up')
            .setRequired(true)
            .setAutocomplete(true))
    .addBooleanOption(option =>
        option.setName('public')
            .setDescription('Show the response publicly (limited to 10 results)')
            .setRequired(false));

export const command = {
    name: 'whatsin',
    args: true,
    usage: usage,
    description: 'Check what is inside a convertible',
    canDM: true,
    aliases: [ 'convert', 'inside' ],
    slashCommand,
    autocompleteHandler: autotype,
    interactionHandler: interact,
    execute: doWHATSIN,
    initialize: initialize,
    save: save,
};
