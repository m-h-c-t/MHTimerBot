import test from 'tape';
import sinon from 'sinon';
import { MessageFlags } from 'discord.js';

import { command } from '../../src/commands/ifind.js';

test('commands - ifind slash command registration', suite => {
    const slashCommand = command.slashCommand.toJSON();
    suite.plan(7);

    suite.is(command.name, 'find-loot', 'uses the slash command name for interaction routing');
    suite.true(command.aliases.includes('ifind'), 'keeps ifind as a prefix-command alias');
    suite.is(slashCommand.name, 'find-loot', 'registers as /find-loot');
    suite.is(slashCommand.options[0].name, 'loot', 'requires a loot option');
    suite.true(slashCommand.options[0].autocomplete, 'supports loot autocomplete');
    suite.is(slashCommand.options[1].name, 'filter', 'supports an optional event filter');
    suite.true(slashCommand.options[1].autocomplete, 'supports filter autocomplete');
});

test('commands - find-loot responds when no loot matches', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        deferReply: sinon.stub().resolves(),
        options: {
            getString: sinon.stub().callsFake(name => name === 'loot' ? 'unknown loot' : null),
        },
        client: {
            nicknames: {
                get: () => ({}),
            },
        },
        editReply: sinon.stub().resolves(),
    };
    suite.plan(3);

    await command.interactionHandler(interaction);

    suite.true(interaction.deferReply.calledOnce, 'defers the interaction reply');
    suite.true(interaction.deferReply.calledWith({ flags: MessageFlags.Ephemeral }), 'keeps the reply private');
    suite.true(interaction.editReply.calledWith({
        content: 'Your search for \'unknown loot\' was not a success...',
    }), 'explains when the search has no matches');
});
