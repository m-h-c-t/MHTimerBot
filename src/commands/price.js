const {
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');
const { Duration } = require('luxon');
const CommandResult = require('../interfaces/command-result');
const Logger = require('../modules/logger');
const { fuzzySearch } = require('../modules/search-helpers');

const refresh_rate = Duration.fromObject({ minutes: 120 });

/**
 * @typedef ItemInfo
 * @property {string} name
 * @property {number} item_id
 */

/**
 * @typedef MarketData
 * @property {number} price
 * @property {number} sb_price
 */

/**
 * @typedef MarkethuntItem
 * @property {ItemInfo} item_info
 * @property {MarketData} latest_market_data
 */

/** @type {MarkethuntItem[]} */
let items = [];

async function initialize() {
    await refreshItems();
    setInterval(refreshItems, refresh_rate.as('milliseconds'));
}

async function refreshItems() {
    const response = await fetch('https://api.markethunt.win/items', {
        headers: {
            'X-Requested-With': 'MHTimerBot',
        },
    });

    if (!response.ok) {
        Logger.warn(`Failed to fetch items from Markethunt API: ${response.status} ${response.statusText}`);
        return;
    }

    try {
        const data = await response.json();
        items = data;
        Logger.log(`Fetched ${items.length} items from Markethunt API`);
    } catch (error) {
        Logger.error('Error parsing Markethunt API response:', error);
    }
}

async function execute(message, item) {
    const commandResult = new CommandResult({
        message,
        success: false,
        sentDM: false,
    });

    let reply = '';
    if (!item.length) {
        reply = 'I just cannot find what you\'re looking for (since you didn\'t tell me what it was).';
    } else {
        const results = getBestMatch(item[0]);
        if (results == null) {
            reply = `No items found matching: ${item[0]}`;
        } else {
            reply = `I see **${results.name}** selling for:\n\n` +
                `Gold: ${results.gold}\n` +
                `${getSuperBrieEmoji(message)}: ${results.sb}`;
        }
    }

    try {
        await message.channel.send(reply);

        commandResult.replied = true;
        commandResult.success = true;
        commandResult.sentDm = message.channel.isDMBased();
    } catch (err) {
        Logger.error('PRICE: failed to send reply', err);
        commandResult.botError = true;
    }

    return commandResult;
}

/**
 *
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function interact(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const searchValue = interaction.options.getString('item');
    const results = getBestMatch(searchValue);

    const messageFlags = interaction.guildId != null
        ? MessageFlags.Ephemeral
        : 0;
    if (results == null) {
        await interaction.reply({
            content: `No items found matching: ${searchValue}`,
            flags: messageFlags,
        });
        return;
    }

    await interaction.reply({
        content: `I see **${results.name}** selling for:\n\n` +
        `Gold: ${results.gold}\n` +
        `${getSuperBrieEmoji(interaction)}: ${results.sb}`,
        flags: messageFlags,
    });
}

/**
 *
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function autocomplete(interaction) {
    if (!interaction.isAutocomplete()) return;

    const focusedValue = interaction.options.getFocused();
    const results = fuzzySearch(focusedValue, items, (item) => item.item_info.name);

    await interaction.respond(
        results.map(r => ({ name: r.obj.item_info.name, value: r.obj.item_info.name })),
    );
}

function getBestMatch(name) {
    const results = fuzzySearch(name, items, (item) => item.item_info.name);
    if (!results.length) {
        return null;
    }

    const bestMatch = results[0];
    const itemName = bestMatch.obj.item_info.name;
    const goldValue = bestMatch.obj.latest_market_data.price.toLocaleString();
    const sbValue = bestMatch.obj.latest_market_data.sb_price.toFixed(2);

    return {
        name: itemName,
        gold: goldValue,
        sb: sbValue,
    };
}

function getSuperBrieEmoji(interaction) {
    let sbEmoji = 'SB+';
    if (interaction.guildId != null && 'emoji' in interaction.client.settings.guilds[interaction.guildId]) {
        sbEmoji = interaction.client.settings.guilds[interaction.guildId].emoji.sb || 'SB+';
    }

    return sbEmoji;
}

const slashCommand = new SlashCommandBuilder()
    .setName('price')
    .setDescription('Get the price of an item from the marketplace')
    .setContexts([
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel,
    ])
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addStringOption(option =>
        option.setName('item')
            .setRequired(true)
            .setDescription('The item to look up')
            .setAutocomplete(true),
    );

/** @type {import('../interfaces/command').CommandData} */
module.exports = {
    name: 'price',
    description: 'Get the price of an item from the marketplace',
    aliases: ['marketprice', 'itemprice'],
    slashCommand: slashCommand,
    execute: execute,
    autocompleteHandler: autocomplete,
    interactionHandler: interact,
    initialize: initialize,
};
