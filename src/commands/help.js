// eslint-disable-next-line no-unused-vars
import { CommandInteraction, Message, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { CommandResult } from '../interfaces/command-result.js';
import { oxfordStringifyValues, splitMessageRegex } from '../modules/format-utils.js';
import { Logger } from '../modules/logger.js';
import { checkPerms } from '../modules/security.js';

function canUseCommand(command, user, client) {
    if (command.ownerOnly && user.id !== client.settings.owner) return false;
    if (!command.minPerm) return true;
    if (user.id === client.settings.owner) return true;
    return checkPerms(user.member ?? user, command.minPerm);
}

function getHelpMessage(commands, user, client, tokens, prefix, isSlash = false) {
    const helpText = Object.fromEntries(
        [...commands.values()]
            .filter(command => canUseCommand(command, user, client))
            .map(command => [command.name, {
                name: command.name,
                description: command.description,
                aliases: command.aliases ?? [],
                ownerOnly: command.ownerOnly,
                usage: command.usage,
                helpFunction: command.helpFunction,
            }]),
    );
    const names = Object.keys(helpText);
    const keywords = oxfordStringifyValues(names.map(name => `\`${name}\``));

    if (!tokens.length) {
        return [
            '**help**',
            `I know the keywords ${keywords}.`,
            isSlash
                ? 'Use `/help command:<keyword>` for information about a specific command.'
                : `You can use \`${prefix} help <keyword>\` to get specific information about how to use it.`,
            isSlash
                ? 'Example: `/help command:next` provides help about the next command.'
                : `Example: \`${prefix} help next\` provides help about the 'next' keyword, \`${prefix} help remind\` provides help about the 'remind' keyword.`,
            'Pro Tip: **Most commands work in PM!**',
        ].join('\n');
    }

    const requested = tokens[0].toLowerCase();
    const command = Object.values(helpText).find(entry =>
        entry.name === requested || entry.aliases.includes(requested));
    if (!command) return `I don't know that one, but I do know ${keywords}.`;
    if (command.helpFunction) return command.helpFunction();
    if (command.usage) {
        const invocation = isSlash ? `/${command.name}` : `${prefix} ${command.name}`;
        return `\`\`\`\n${invocation}:\n\t${command.usage.replace('\n', '\t\n')}\n\`\`\``;
    }
    return `I know how to ${requested} but I don't know how to tell you how to ${requested}`;
}

function getPrefix(message) {
    if (message.guild && message.client.settings.guilds[message.guild.id].botPrefix)
        return message.client.settings.guilds[message.guild.id].botPrefix.trim();
    return message.client.settings.botPrefix.trim();
}

function splitHelpMessage(message) {
    const isCodeBlock = message.startsWith('```\n') && message.endsWith('\n```');
    return splitMessageRegex(message, isCodeBlock
        ? { prepend: '```\n', append: '\n```' }
        : {});
}

/**
 * Display help text for prefix and slash commands.
 * @param {Message} message The message that triggered the command
 * @param {string[]} tokens The requested command, if any
 * @returns {Promise<CommandResult>} Status of the execution
 */
async function execute(message, tokens = []) {
    const result = new CommandResult({ message, success: false, sentDM: false });
    const reply = getHelpMessage(message.client.commands, {
        id: message.author.id,
        member: message.member,
    }, message.client, tokens, getPrefix(message));

    try {
        for (const content of splitHelpMessage(reply))
            await message.channel.send(content);
        result.replied = true;
        result.success = true;
        result.sentDm = message.channel.isDMBased();
    } catch (err) {
        Logger.error('HELP: failed to send reply', err);
        result.botError = true;
    }
    return result;
}

/**
 * Reply to slash help requests.
 * @param {CommandInteraction} interaction The command interaction
 */
async function interact(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const requested = interaction.options.getString('command');
    const isPublic = interaction.options.getBoolean('public') ?? false;
    const tokens = requested ? [requested] : [];
    const reply = getHelpMessage(
        interaction.client.commands,
        { id: interaction.user.id, member: interaction.member },
        interaction.client,
        tokens,
        interaction.client.settings.botPrefix.trim(),
        true,
    );
    const messages = splitHelpMessage(reply);
    await interaction.reply({
        content: messages[0],
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
    });
    for (const content of messages.slice(1)) {
        await interaction.followUp({
            content,
            flags: isPublic ? undefined : MessageFlags.Ephemeral,
        });
    }
}

/**
 * Autocomplete help topics from registered command names and aliases.
 * @param {CommandInteraction} interaction The autocomplete interaction
 */
async function autocomplete(interaction) {
    if (!interaction.isAutocomplete()) return;

    const search = interaction.options.getFocused().toLowerCase();
    const choices = [...interaction.client.commands.values()]
        .flatMap(command => [command.name, ...(command.aliases ?? [])])
        .filter(name => name.toLowerCase().includes(search))
        .slice(0, 25)
        .map(name => ({ name, value: name }));
    await interaction.respond(choices);
}

const slashCommand = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with bot commands')
    .addStringOption(option =>
        option.setName('command')
            .setDescription('Command to get help for')
            .setRequired(false)
            .setAutocomplete(true))
    .addBooleanOption(option =>
        option.setName('public')
            .setDescription('Show the response publicly')
            .setRequired(false));

export const command = {
    name: 'help',
    aliases: ['arrg', 'aarg'],
    description: 'Display command help',
    execute,
    slashCommand,
    interactionHandler: interact,
    autocompleteHandler: autocomplete,
};
