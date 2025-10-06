
/**
 * @typedef {Object} CommandData
 * @property {string} name - The name of the command (must be lowercase)
 * @property {string} description - A short description of the command
 * @property {string[]} [aliases] - Alternative names for the command (all must be lowercase)
 * @property {function(import('discord.js').Message, string[])} [execute] - The callback to be executed when the command is invoked via message
 * @property {require('discord.js').SlashCommandBuilder} [slashCommand] - The slash command builder for registering the command
 * @property {function(import('discord.js').CommandInteraction)} [interactionHandler] - The callback to be executed when the interaction is invoked
 * @property {function(import('discord.js').CommandInteraction)} [autocompleteHandler] - The callback to be executed when the interaction is invoked
 * @property {function} [initialize] - The callback to be executed when the bot starts up
 */
