import test from 'tape';
import sinon from 'sinon';
import { MessageFlags } from 'discord.js';

import { command as help } from '../../src/commands/help.js';

function makeClient() {
    const commands = new Map([
        ['help', help],
        ['lookup', {
            name: 'lookup',
            description: 'Find an item',
            aliases: ['find-item'],
            usage: Array.from({ length: 160 }, (_, index) => `usage detail ${index}`).join('\n'),
        }],
    ]);
    return {
        commands,
        settings: { botPrefix: '-mh', owner: 'owner-id' },
    };
}

test('help command - prefix help collects registered command information', async suite => {
    const client = makeClient();
    const message = {
        client,
        author: { id: 'user-id' },
        channel: {
            send: sinon.stub().resolves(),
            isDMBased: () => false,
        },
    };
    suite.plan(3);

    const result = await help.execute(message, ['find-item']);

    suite.ok(result.success, 'prefix help succeeds');
    const responses = message.channel.send.args.map(([content]) => content);
    suite.ok(responses[0].startsWith('```\n-mh lookup:'), 'resolves aliases from registered command help text');
    suite.ok(responses.length > 1 && responses.at(-1).includes('usage detail 159'), 'splits lengthy help across messages without truncating');
});

test('slash command - help defaults to private and preserves complete command help', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        user: { id: 'user-id' },
        member: null,
        client: makeClient(),
        options: {
            getString: () => 'lookup',
            getBoolean: () => null,
        },
        reply: sinon.stub().resolves(),
        followUp: sinon.stub().resolves(),
    };
    suite.plan(4);

    await help.interactionHandler(interaction);

    suite.equal(interaction.reply.firstCall.args[0].flags, MessageFlags.Ephemeral, 'defaults to ephemeral');
    suite.ok(interaction.followUp.called, 'sends remaining help as follow-ups');
    suite.ok(interaction.reply.firstCall.args[0].content.startsWith('```\n/lookup:'), 'uses slash syntax for command help');
    const responses = [
        interaction.reply.firstCall.args[0].content,
        ...interaction.followUp.args.map(([response]) => response.content),
    ];
    suite.ok(responses.join('\n').includes('usage detail 159'), 'includes all help text');
});

test('slash command - help supports public replies and autocomplete', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        user: { id: 'user-id' },
        member: null,
        client: makeClient(),
        options: {
            getString: () => null,
            getBoolean: () => true,
        },
        reply: sinon.stub().resolves(),
        followUp: sinon.stub().resolves(),
    };
    suite.plan(3);

    await help.interactionHandler(interaction);
    suite.notOk(interaction.reply.firstCall.args[0].flags, 'public option omits ephemeral flags');

    const autocompleteInteraction = {
        isAutocomplete: () => true,
        options: { getFocused: () => 'find' },
        client: interaction.client,
        respond: sinon.stub().resolves(),
    };
    await help.autocompleteHandler(autocompleteInteraction);
    suite.deepEqual(autocompleteInteraction.respond.firstCall.args[0], [
        { name: 'find-item', value: 'find-item' },
    ], 'autocompletes command aliases');
    suite.ok(help.slashCommand.toJSON().options.some(option => option.name === 'public'), 'registers the public option');
});
