import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { CommandResult } from '../interfaces/command-result.js';
import { Logger } from '../modules/logger.js';

const response = 'So long, and thanks for all the fish.';

async function execute(message) {
    const result = new CommandResult({ message, success: false });
    if (message.author.id !== message.client.settings.owner) {
        await message.reply({ content: 'Only the bot owner can shut down the bot.' });
        result.replied = true;
        return result;
    }

    try {
        await message.channel.send(response);
        result.replied = true;
        result.success = true;
        await message.client.shutdown();
    } catch (err) {
        Logger.error('SHUTDOWN: failed to shut down', err);
        result.botError = true;
    }
    return result;
}

async function interact(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.user.id !== interaction.client.settings.owner) {
        await interaction.reply({
            content: 'Only the bot owner can shut down the bot.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const isPublic = interaction.options.getBoolean('public') ?? false;
    await interaction.reply({
        content: response,
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
    });
    await interaction.client.shutdown();
}

const slashCommand = new SlashCommandBuilder()
    .setName('shutdown')
    .setDescription('Shut down the bot (owner only)')
    .addBooleanOption(option =>
        option.setName('public')
            .setDescription('Show the response publicly')
            .setRequired(false));

export const command = {
    name: 'shutdown',
    description: 'Shut down the bot (owner only)',
    ownerOnly: true,
    execute,
    slashCommand,
    interactionHandler: interact,
};
