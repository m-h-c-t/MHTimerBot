import test from 'tape';
import sinon from 'sinon';
import { MessageFlags } from 'discord.js';

import { command as shutdown } from '../../src/commands/shutdown.js';

test('shutdown command - prefix access is restricted to the owner', async suite => {
    const unauthorizedMessage = {
        author: { id: 'user-id' },
        client: { settings: { owner: 'owner-id' }, shutdown: sinon.stub().resolves() },
        reply: sinon.stub().resolves(),
        channel: { send: sinon.stub().resolves() },
    };
    suite.plan(3);

    const deniedResult = await shutdown.execute(unauthorizedMessage);

    suite.ok(deniedResult.replied, 'replies to unauthorized user');
    suite.ok(unauthorizedMessage.reply.calledWithMatch({
        content: 'Only the bot owner can shut down the bot.',
    }), 'explains owner restriction');
    suite.notOk(unauthorizedMessage.client.shutdown.called, 'does not shut down for unauthorized user');
});

test('shutdown command - owner prefix request confirms and shuts down', async suite => {
    const message = {
        author: { id: 'owner-id' },
        client: { settings: { owner: 'owner-id' }, shutdown: sinon.stub().resolves() },
        channel: {
            send: sinon.stub().resolves(),
        },
    };
    suite.plan(3);

    const result = await shutdown.execute(message);

    suite.ok(result.success, 'owner request succeeds');
    suite.ok(message.channel.send.calledWith('So long, and thanks for all the fish.'), 'confirms shutdown');
    suite.ok(message.client.shutdown.calledOnce, 'runs graceful shutdown');
});

test('shutdown slash command - unauthorized invocation is private and does not shut down', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        user: { id: 'user-id' },
        client: { settings: { owner: 'owner-id' }, shutdown: sinon.stub().resolves() },
        reply: sinon.stub().resolves(),
    };
    suite.plan(3);

    await shutdown.interactionHandler(interaction);

    suite.equal(interaction.reply.firstCall.args[0].flags, MessageFlags.Ephemeral, 'denial is ephemeral');
    suite.match(interaction.reply.firstCall.args[0].content, /Only the bot owner/, 'explains owner restriction');
    suite.notOk(interaction.client.shutdown.called, 'does not shut down for unauthorized user');
});

test('shutdown slash command - owner gets private response by default and shuts down', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        user: { id: 'owner-id' },
        client: { settings: { owner: 'owner-id' }, shutdown: sinon.stub().resolves() },
        options: { getBoolean: () => null },
        reply: sinon.stub().resolves(),
    };
    suite.plan(3);

    await shutdown.interactionHandler(interaction);

    suite.equal(interaction.reply.firstCall.args[0].flags, MessageFlags.Ephemeral, 'defaults to ephemeral');
    suite.match(interaction.reply.firstCall.args[0].content, /So long/, 'confirms shutdown');
    suite.ok(interaction.client.shutdown.calledOnce, 'runs graceful shutdown');
});
