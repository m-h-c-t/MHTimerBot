// eslint-disable-next-line no-unused-vars
import { Message } from 'discord.js';

import {CommandResult} from '../interfaces/command-result.js';
import {Logger} from '../modules/logger.js';
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

export const command = {
    name: 'whatsin',
    args: true,
    usage: usage,
    description: 'Check what is inside a convertable',
    canDM: true,
    aliases: [ 'convert', 'inside' ],
    execute: doWHATSIN,
    initialize: initialize,
    save: save,
};
