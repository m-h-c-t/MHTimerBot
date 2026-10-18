// eslint-disable-next-line no-unused-vars
import { Message, MessageFlags, CommandInteraction, SlashCommandBuilder } from 'discord.js';

import { DateTime, Duration } from 'luxon';
import { CommandResult } from '../interfaces/command-result.js';
import { timeLeft, splitMessageRegex } from '../modules/format-utils.js';
import { Logger } from '../modules/logger.js';
import { timerAliases } from '../modules/timer-helper.js';

const usage = [
    'Displays upcoming reminders know or filtered to an area or sub-area.',
    '<area>            -> specify a particular area with a timer (sg)',
    '<sub-area>        -> specify the specific sub-area for the reminder (autumn)',
    '<number>          -> How many hours into the future you\'re looking',
    'Areas are Seasonal Garden (sg), Forbidden Grove (fg), Toxic Spill (ts), Balack\'s Cove (cove), and the daily reset (reset).',
    'Sub areas are the seasons (winter, spring, summer, fall), open/close, spill ranks, and tide levels (low, mid, high)',
    'Example: "-mh sched 24" will show you the timers for the next 24 hours.',
    'See Also: next; for when a timer occurs next. remind; for setting a reminder for a specific timer.',
].join('\n\t');

/**
 * @param {Message} message
 * @param {string[]} tokens
 * @returns {Promise<CommandResult>}
 */
async function doSCHED(message, tokens) {
    const theResult = new CommandResult({ message, success: false, sentDM: false });
    const timerRequest = timerAliases(message.client.timers_list, tokens);
    const { reply, isValid } = getScheduleReply(message.client.timers_list, timerRequest);

    if (!isValid) {
        try {
            await message.channel.send('Invalid timespan given - how many hours did you want to look ahead?');
            theResult.replied = true;
            theResult.success = false;
            theResult.sentDM = message.channel.isDMBased();
        } catch (err) {
            Logger.error('SCHED: failed to send reply', err);
            theResult.botError = true;
        }
        return theResult;
    }

    if (reply) {
        try {
            // Note that a lot of this is handled by sendInteractiveSearchResult.
            if (typeof reply === 'string') {
                for (const msg of splitMessageRegex(reply)) {
                    await message.channel.send(msg);
                }
            } else {
                await message.channel.send({ embeds: [reply] });
            }
            theResult.replied = true;
            theResult.success = true;
            theResult.sentDM = message.channel.isDMBased();
        } catch (err) {
            Logger.error('SCHED: failed to send reply', err);
            theResult.botError = true;
        }
    }
    return theResult;
}

function getScheduleReply(timers, timerRequest) {
    // Default the searched time period to 24 hours if it was not specified.
    timerRequest.count = timerRequest.count || 24;

    // Search from 1 hour to 10 days out.
    let reqHours = Duration.fromObject({ hours: timerRequest.count });
    if (!reqHours.isValid) return { reply: '', isValid: false };
    if (reqHours.as('hours') <= 0)
        reqHours = reqHours.set({ hours: 24 });
    else if (reqHours.as('days') >= 10)
        reqHours = reqHours.shiftTo('days').set({ days: 10 });

    const until = DateTime.utc().plus(reqHours);
    /** @type {{time: DateTime, message: string}[]} */
    const upcomingTimers = [];
    const maxTimers = 24;
    const areaTimers = timerRequest.area
        ? timers.filter(timer => timer.getArea() === timerRequest.area
            && (!timerRequest.sub_area || timer.getSubArea() === timerRequest.sub_area)
            && !timer.isSilent())
        : timers;
    areaTimers.forEach(timer => {
        const message = timer.getDemand();
        for (const time of timer.upcoming(until))
            upcomingTimers.push({ time, message });
    });

    upcomingTimers.sort((a, b) => a.time - b.time);

    let reply = `I have ${upcomingTimers.length} timers coming up in the next ${reqHours.as('hours')} hours`;
    if (upcomingTimers.length > maxTimers) {
        reply += `. Here are the next ${maxTimers} of them`;
        upcomingTimers.splice(maxTimers, upcomingTimers.length);
    }
    reply += upcomingTimers.length ? ':\n' : '.';

    reply = upcomingTimers.reduce((str, val) => {
        return `${str}${val.message} ${timeLeft(val.time)}\n`;
    }, reply);

    return { reply, isValid: true };
}

/**
 * Reply to an autocomplete request with area and sub-area names from the loaded timers.
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
 * Reply to a slash command.
 * @param {CommandInteraction} interaction The command interaction
 */
async function interact(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const tokens = [
        interaction.options.getString('area'),
        interaction.options.getString('sub-area'),
        interaction.options.getInteger('hours')?.toString(),
    ].filter(Boolean);
    const timerRequest = timerAliases(interaction.client.timers_list, tokens);
    const { reply, isValid } = getScheduleReply(interaction.client.timers_list, timerRequest);
    if (!isValid) {
        await interaction.reply({
            content: 'Invalid timespan given - how many hours did you want to look ahead?',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const pages = splitMessageRegex(reply);
    await interaction.reply({ content: pages[0] });
    for (const page of pages.slice(1)) {
        await interaction.followUp({ content: page });
    }
}

const slashCommand = new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Show upcoming MouseHunt timers')
    .addStringOption(option =>
        option.setName('area')
            .setDescription('Filter timers to an area')
            .setRequired(false)
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('sub-area')
            .setDescription('Filter timers to a sub-area')
            .setRequired(false)
            .setAutocomplete(true))
    .addIntegerOption(option =>
        option.setName('hours')
            .setDescription('How many hours ahead to look (default: 24; maximum: 240)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(240));

export const command = {
    name: 'schedule',
    args: true,
    usage: usage,
    description: 'Set and retrieve reminders for MouseHunt Timers',
    canDM: true,
    aliases: ['sched', 'agenda', 'itinerary', 'itin'],
    slashCommand,
    autocompleteHandler: autotype,
    interactionHandler: interact,
    execute: doSCHED,
};
