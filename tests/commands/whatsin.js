import test from 'tape';
import sinon from 'sinon';
import { MessageFlags } from 'discord.js';

import { command } from '../../src/commands/whatsin.js';

test('commands - whatsin slash command registration', suite => {
    const slashCommand = command.slashCommand.toJSON();
    suite.plan(6);

    suite.is(slashCommand.name, 'whatsin', 'registers as /whatsin');
    suite.equal(slashCommand.options.length, 2, 'takes a convertible and public option');
    suite.is(slashCommand.options[0].name, 'convertible', 'takes a convertible name');
    suite.true(slashCommand.options[0].required, 'requires a convertible name');
    suite.true(slashCommand.options[0].autocomplete, 'supports convertible autocomplete');
    suite.is(slashCommand.options[1].name, 'public', 'offers an optional public response');
});

test('commands - whatsin responds when no convertible matches', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        deferReply: sinon.stub().resolves(),
        options: {
            getString: sinon.stub().returns('unknown convertible'),
            getBoolean: sinon.stub().returns(false),
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

test('commands - public whatsin omits ephemeral flags', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        deferReply: sinon.stub().resolves(),
        options: {
            getString: sinon.stub().returns('unknown convertible'),
            getBoolean: sinon.stub().returns(true),
        },
        editReply: sinon.stub().resolves(),
    };
    suite.plan(1);

    await command.interactionHandler(interaction);

    suite.notOk(interaction.deferReply.firstCall.args[0].flags, 'public response is not ephemeral');
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
