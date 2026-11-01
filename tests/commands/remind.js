import test from 'tape';
import sinon from 'sinon';
import { MessageFlags } from 'discord.js';

import { command } from '../../src/commands/remind.js';

test('commands - remind slash command registration', suite => {
    const slashCommand = command.slashCommand.toJSON();
    suite.plan(7);

    suite.is(slashCommand.name, 'remind', 'registers as /remind');
    suite.equal(slashCommand.options.length, 4, 'has area, sub-area, count, and public options');
    suite.is(slashCommand.options[0].name, 'area', 'supports an area option');
    suite.true(slashCommand.options[0].autocomplete, 'supports area autocomplete');
    suite.is(slashCommand.options[1].name, 'sub-area', 'supports a sub-area option');
    suite.equal(slashCommand.options[2].name, 'count', 'supports a repeat count');
    suite.equal(slashCommand.options[3].name, 'public', 'offers a public response option');
});

test('commands - remind slash command sets reminder count', async suite => {
    const client = mockClient();
    const interaction = mockInteraction(client, { area: 'sg', count: -1 });
    suite.plan(4);

    await command.interactionHandler(interaction);

    suite.equal(client.reminders.length, 1, 'creates the reminder');
    suite.equal(client.reminders[0].count, -1, 'stores an indefinite repeat count');
    suite.equal(client.reminders[0].area, 'sg', 'stores the requested timer area');
    suite.true(interaction.reply.calledWithMatch({ flags: MessageFlags.Ephemeral }), 'replies privately');
});

test('commands - remind defaults to a single reminder', async suite => {
    const client = mockClient();
    const interaction = mockInteraction(client, { area: 'sg' });
    suite.plan(1);

    await command.interactionHandler(interaction);

    suite.equal(client.reminders[0].count, 1, 'defaults to one reminder');
});

test('commands - remind slash command can stop a reminder', async suite => {
    const client = mockClient();
    client.reminders.push({ count: 2, area: 'sg', user: 'user-id' });
    const interaction = mockInteraction(client, { area: 'sg', count: 0 });
    suite.plan(2);

    await command.interactionHandler(interaction);

    suite.equal(client.reminders[0].count, 0, 'turns off the matching reminder');
    suite.true(interaction.reply.firstCall.args[0].content.includes('turned off'), 'confirms the reminder was stopped');
});

test('commands - remind without options lists reminders privately', async suite => {
    const interaction = mockInteraction(mockClient(), {});
    suite.plan(2);

    await command.interactionHandler(interaction);

    suite.true(interaction.reply.calledWithMatch({ flags: MessageFlags.Ephemeral }), 'keeps reminder list private');
    suite.true(interaction.reply.firstCall.args[0].content.includes('no reminders'), 'reports an empty reminder list');
});

test('commands - remind slash reminder list shows slash-compatible stop syntax', async suite => {
    const client = mockClient();
    client.reminders.push({ count: -1, area: 'sg', sub_area: 'winter', user: 'user-id' });
    const interaction = mockInteraction(client, {});
    suite.plan(2);

    await command.interactionHandler(interaction);

    const response = interaction.reply.firstCall.args[0].content;
    suite.true(response.includes('/remind area: sg sub-area: winter count: 0'), 'shows a valid slash command to stop the reminder');
    suite.false(response.includes('slash commands'), 'does not display invalid placeholder syntax');
});

test('commands - public reminder list indicates truncated entries', async suite => {
    const client = mockClient();
    client.reminders = Array.from({ length: 12 }, (_, index) => ({
        count: 1,
        area: `area-${index}`,
        user: 'user-id',
    }));
    const interaction = mockInteraction(client, { public: true });
    suite.plan(3);

    await command.interactionHandler(interaction);

    const response = interaction.reply.firstCall.args[0];
    suite.notOk(response.flags, 'does not make a public response ephemeral');
    suite.equal((response.content.match(/Timer:/g) || []).length, 10, 'includes at most ten reminder entries');
    suite.true(response.content.includes('(...and more)'), 'indicates that additional reminders were omitted');
});

test('commands - public reminder list includes exactly eleven entries', async suite => {
    const client = mockClient();
    client.reminders = Array.from({ length: 11 }, (_, index) => ({
        count: 1,
        area: `area-${index}`,
        user: 'user-id',
    }));
    const interaction = mockInteraction(client, { public: true });
    suite.plan(2);

    await command.interactionHandler(interaction);

    const response = interaction.reply.firstCall.args[0].content;
    suite.equal((response.match(/Timer:/g) || []).length, 11, 'includes all eleven reminder entries');
    suite.false(response.includes('(...and more)'), 'does not indicate truncation for exactly eleven reminders');
});

test('commands - remind autocomplete suggests area and sub-area names', async suite => {
    const respond = sinon.stub().resolves();
    const interaction = {
        isAutocomplete: () => true,
        options: {
            getFocused: () => ({ name: 'sub-area', value: '' }),
            getString: () => 'sg',
        },
        client: {
            timers_list: [makeTimer('sg', 'winter'), makeTimer('fg', 'close')],
        },
        respond,
    };
    suite.plan(2);

    await command.autocompleteHandler(interaction);

    suite.true(respond.calledOnce, 'responds to autocomplete');
    suite.deepEqual(respond.firstCall.args[0], [{ name: 'winter', value: 'winter' }], 'filters sub-areas by area');
});

function mockClient() {
    return {
        reminders: [],
        timers_list: [makeTimer('sg', 'winter')],
    };
}

function makeTimer(area, subArea) {
    return {
        getArea: () => area,
        getSubArea: () => subArea,
        getNext: () => 1,
        getDemand: () => `${subArea} timer`,
        get name() {
            return `${area}: ${subArea}`;
        },
    };
}

function mockInteraction(client, options) {
    return {
        isChatInputCommand: () => true,
        options: {
            getString: name => options[name] || null,
            getInteger: name => options[name] ?? null,
            getBoolean: name => options[name] ?? false,
        },
        user: { id: 'user-id', username: 'user', tag: 'user#0000' },
        client,
        reply: sinon.stub().resolves(),
    };
}
