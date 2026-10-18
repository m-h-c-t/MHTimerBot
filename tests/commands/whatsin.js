import test from 'tape';
import sinon from 'sinon';
import { MessageFlags } from 'discord.js';

import { command } from '../../src/commands/whatsin.js';

test('commands - whatsin slash command registration', suite => {
    const slashCommand = command.slashCommand.toJSON();
    suite.plan(5);

    suite.is(slashCommand.name, 'whatsin', 'registers as /whatsin');
    suite.equal(slashCommand.options.length, 1, 'takes only one option');
    suite.is(slashCommand.options[0].name, 'convertible', 'takes a convertible name');
    suite.true(slashCommand.options[0].required, 'requires a convertible name');
    suite.true(slashCommand.options[0].autocomplete, 'supports convertible autocomplete');
});

test('commands - whatsin responds when no convertible matches', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        deferReply: sinon.stub().resolves(),
        options: {
            getString: sinon.stub().returns('unknown convertible'),
        },
        editReply: sinon.stub().resolves(),
    };
    suite.plan(3);

    await command.interactionHandler(interaction);

    suite.true(interaction.deferReply.calledOnce, 'defers the interaction reply');
    suite.true(interaction.deferReply.calledWith({ flags: MessageFlags.Ephemeral }), 'keeps the reply private');
    suite.true(interaction.editReply.calledWith({
        content: 'I don\'t know anything about "unknown convertible"',
    }), 'explains when the search has no matches');
});

test('commands - whatsin autocomplete does not require nicknames', async suite => {
    const respond = sinon.stub().resolves();
    const interaction = {
        isAutocomplete: () => true,
        options: {
            getFocused: sinon.stub().returns('some convertible'),
        },
        respond,
    };
    suite.plan(1);

    await command.autocompleteHandler(interaction);

    suite.true(respond.calledOnce, 'responds with convertible matches without accessing nicknames');
});
