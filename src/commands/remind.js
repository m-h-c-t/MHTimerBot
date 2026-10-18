// eslint-disable-next-line no-unused-vars
import { codeBlock, Message, MessageFlags, User, CommandInteraction, SlashCommandBuilder } from 'discord.js';

import { CommandResult } from '../interfaces/command-result.js';
import { oxfordStringifyValues, splitMessageRegex } from '../modules/format-utils.js';
import { Logger } from '../modules/logger.js';
import { listRemind, timerAliases, getKnownTimersDetails } from '../modules/timer-helper.js';

const usage = [
    'Provide no arguments for a list of your reminders. Use [<area>] [<sub-area>] [<number>] to set a reminder',
    '<area>            -> specify a particular area with a timer (sg)',
    '<sub-area>        -> specify the specific sub-area for the reminder (autumn)',
    '<number>          -> How many time it should remind you, default 1 (once, always, 5, etc)',
    'Areas are Seasonal Garden (sg), Forbidden Grove (fg), Toxic Spill (ts), Balack\'s Cove (cove), and the daily reset (reset).',
    'Sub areas are the seasons (winter, spring, summer, fall), open/close, spill ranks, and tide levels (low, mid, high)',
    'Example: "-mh remind close always" will always PM you 15 minutes before the Forbidden Grove closes.',
    'See Also: next; for when a timer occurs next. schedule; for seeing a bunch of timers at once.',
].join('\n\t');

/**
 *
 * @param {Message} message The message that triggered the action
 * @param {string[]} tokens The tokens of the command
 * @returns {Promise<CommandResult>} Status of the execution
 */
async function doREMIND(message, tokens) {
    const theResult = new CommandResult({ message, success: false, sentDM: false });
    const timerRequest = timerAliases(message.client.timers_list, tokens);

    // If not given a valid input, advertise the available reminders.
    if (!tokens.length || !timerRequest.area) {
        let botPrefix = message.client.settings.botPrefix;
        if (message.guild && message.client.settings.guilds[message.guild.id].botPrefix) {
            botPrefix = message.client.settings.guilds[message.guild.id].botPrefix;
        }
        // This reminders array could be pre-filtered.
        return sendDM(message.author, theResult, listRemind(message.author.id, message.client.reminders, botPrefix));
    }

    const { text, success } = applyReminderRequest(
        message.client,
        message.author.id,
        message.author.username,
        timerRequest,
    );
    theResult.success = success;
    return sendDM(message.author, theResult, text);
}

/**
 * Apply a reminder request and produce its response text.
 * @param {import('discord.js').Client} client The bot client
 * @param {string} userId The requesting user's Discord ID
 * @param {string} username The requesting user's username
 * @param {object} timerRequest Parsed timer request
 * @returns {{text: string, success: boolean}}
 */
function applyReminderRequest(client, userId, username, timerRequest) {
    const { area, sub_area: subArea } = timerRequest;
    if (!area) return { text: 'I do not know the area you asked for', success: false };

    const count = timerRequest.count || (timerRequest.count === 0 ? 0 : 1);
    const requestName = `${area}${subArea ? `: ${subArea}` : ''}`;
    if (!count) {
        const responses = [];
        for (const reminder of client.reminders) {
            if (reminder.user === userId && reminder.area === area
                && ((subArea && subArea === reminder.sub_area) || (!subArea && !reminder.sub_area))) {
                reminder.count = 0;
                responses.push(`Reminder for '${requestName}' turned off.`);
            }
        }
        return {
            success: responses.length > 0,
            text: responses.length > 0
                ? codeBlock(responses.join('\n'))
                : `I couldn't find a matching reminder for you in "${requestName}".`,
        };
    }

    const choices = client.timers_list
        .filter(timer => area === timer.getArea() && (!subArea || subArea === timer.getSubArea()))
        .sort((a, b) => a.getNext() - b.getNext());
    const [timer] = choices;
    if (!timer) {
        return {
            success: false,
            text: `I'm sorry, there weren't any timers I know of that match your request. I know\n${getKnownTimersDetails(client.timers_list)}`,
        };
    }

    const responses = [];
    for (const reminder of client.reminders) {
        if (reminder.user === userId && reminder.area === area
            && ((subArea && reminder.sub_area === subArea) || (!subArea && !reminder.sub_area))) {
            responses.push(`Updated reminder count for '${requestName}' from '${reminder.count === -1
                ? 'always' : reminder.count}' to '${count === -1 ? 'always' : count}'.`);
            reminder.count = count;
        }
    }
    if (responses.length) {
        Logger.log(`REMIND: updated ${responses.length} for ${username} to a count of ${count}.`, timerRequest);
        return { text: codeBlock(responses.join('\n')), success: true };
    }

    /** @type {{count: number, area: string, user: string, sub_area?: string}} */
    const newReminder = { count, area, user: userId };
    if (timer.getSubArea()) newReminder.sub_area = subArea;
    client.reminders.push(newReminder);

    const isGenericRequest = !subArea && timer.getSubArea();
    const subAreas = new Set(choices.map(choice => `**${choice.getSubArea()}**`));
    responses.push(`Your reminder for **${isGenericRequest ? area : timer.name}** is set. ${choices.length > 1
        ? `You'll get reminders for ${oxfordStringifyValues(subAreas)}. I'll PM you about them`
        : 'I\'ll PM you about it'}`);
    responses.push((count === 1) ? 'once.' : (count < 0) ? 'until you stop it.' : `${count} times.`);
    if (!client.reminders.some(reminder => reminder.user === userId))
        responses.unshift('Hi there! Reminders are only sent via PM, and I\'m just making sure I can PM you.');
    return { text: responses.join(' '), success: true };
}

/**
 * Reply to autocomplete requests with timer areas and sub-areas.
 * @param {CommandInteraction} interaction Must be an autocomplete interaction
 */
async function autotype(interaction) {
    if (!interaction.isAutocomplete()) return;

    const focusedOption = interaction.options.getFocused(true);
    const timers = interaction.client.timers_list;
    let values;
    if (focusedOption.name === 'area') {
        values = [...new Set(timers.map(timer => timer.getArea()))];
    } else if (focusedOption.name === 'sub-area') {
        const area = interaction.options.getString('area');
        values = [...new Set(timers
            .filter(timer => !area || timer.getArea() === area)
            .map(timer => timer.getSubArea())
            .filter(Boolean))];
    } else {
        return;
    }

    const search = focusedOption.value.toLowerCase();
    await interaction.respond(
        values
            .filter(value => value.toLowerCase().includes(search))
            .slice(0, 25)
            .map(value => ({ name: value, value })),
    );
}

/**
 * Handle a slash reminder request.
 * @param {CommandInteraction} interaction The command interaction
 */
async function interact(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const area = interaction.options.getString('area');
    const subArea = interaction.options.getString('sub-area');
    const repeatCount = interaction.options.getInteger('count');
    const isPublic = interaction.options.getBoolean('public') ?? false;
    if (!area && !subArea) {
        await interaction.reply({
            content: listRemind(
                interaction.user.id,
                interaction.client.reminders,
                '',
                true,
                isPublic ? 10 : undefined,
            ),
            flags: isPublic ? undefined : MessageFlags.Ephemeral,
        });
        return;
    }

    const tokens = [area, subArea, repeatCount == null ? null : `${repeatCount}`].filter(Boolean);
    const timerRequest = timerAliases(interaction.client.timers_list, tokens);
    if (repeatCount != null) timerRequest.count = repeatCount;
    const { text } = applyReminderRequest(
        interaction.client,
        interaction.user.id,
        interaction.user.username,
        timerRequest,
    );
    await interaction.reply({
        content: text,
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
    });
}

const slashCommand = new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set, stop, or list your timer reminders')
    .addStringOption(option =>
        option.setName('area')
            .setDescription('Timer area')
            .setRequired(false)
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('sub-area')
            .setDescription('Specific timer in the area')
            .setRequired(false)
            .setAutocomplete(true))
    .addIntegerOption(option =>
        option.setName('count')
            .setDescription('Times to remind (default: 1, 0 stops, -1 repeats indefinitely)')
            .setRequired(false)
            .setMinValue(-1))
    .addBooleanOption(option =>
        option.setName('public')
            .setDescription('Show the response publicly (reminder lists limited to 10)')
            .setRequired(false));

/**
 * Helper method to DM a user some preformatted text.
 * @param {User} author the user to DM
 * @param {CommandResult} result the current result of the REMIND command, with success or failure already set.
 * @param {string} text the message to send via DM.
 * @returns {Promise<CommandResult>}
 */
async function sendDM(author, result, text) {
    try {
        for (const msg of splitMessageRegex(text)) {
            await author.send(msg);
        }
        result.sentDM = true;
    } catch (err) {
        Logger.error(`REMIND: notification failure for ${author.tag}. Possibly blocked.`, err);
        result.botError = true;
    }
    return result;
}

export const command = {
    name: 'remind',
    args: true,
    usage: usage,
    description: 'Set and retrieve reminders for MouseHunt Timers',
    canDM: true,
    execute: doREMIND,
    slashCommand,
    autocompleteHandler: autotype,
    interactionHandler: interact,
};
