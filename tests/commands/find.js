import test from 'tape';
import sinon from 'sinon';
import { MessageFlags } from 'discord.js';

import { mockMessage } from '../helpers/mock-message.js';
import { command } from '../../src/commands/find.js';

test('commands - find-mouse defaults to private and supports public responses', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        options: {
            getString: name => name === 'mouse' ? 'unknown mouse' : null,
            getBoolean: () => false,
        },
        client: { nicknames: { get: () => ({}) } },
        deferReply: sinon.stub().resolves(),
        editReply: sinon.stub().resolves(),
    };
    suite.plan(2);

    await command.interactionHandler(interaction);

    suite.equal(interaction.deferReply.firstCall.args[0].flags, MessageFlags.Ephemeral, 'defaults to ephemeral');
    interaction.options.getBoolean = () => true;
    interaction.deferReply.resetHistory();
    await command.interactionHandler(interaction);
    suite.notOk(interaction.deferReply.firstCall.args[0].flags, 'public option omits ephemeral flags');
});

test('commands - find filter autocomplete responds with an empty choice list when no filter matches', async suite => {
    const respond = sinon.stub().resolves();
    const interaction = {
        isAutocomplete: () => true,
        options: {
            getFocused: () => ({ name: 'filter', value: 'no matching filter' }),
        },
        respond,
    };
    suite.plan(1);

    await command.autocompleteHandler(interaction);

    suite.deepEqual(respond.firstCall.args[0], [], 'responds with no choices when the filter does not match');
});

test('commands - find Relic Hunter', async suite => {
    const aliases = ['rh', 'relic_hunter', 'relic hunter'];
    suite.teardown(() => sinon.restore());
    suite.plan(aliases.length * 4);

    for (const alias of aliases) {
        const findRelicHunter = sinon.stub().resolves('Relic Hunter has been spotted');
        const message = mockMessage({ clientStub: { findRelicHunter } });
        message.channel.isDMBased = () => false;

        const result = await command.execute(message, alias.split(' '));

        suite.true(findRelicHunter.calledOnce, `looks up ${alias}`);
        suite.true(message.channel.send.calledOnce, `replies for ${alias}`);
        suite.is(message.channel.send.firstCall.args[0], 'Relic Hunter has been spotted');
        suite.true(result.success, `succeeds for ${alias}`);
    }
});
