import test from 'tape';
import sinon from 'sinon';
import { DateTime } from 'luxon';
import { MessageFlags } from 'discord.js';

import { command } from '../../src/commands/next.js';

test('commands - next slash command registration', suite => {
    const slashCommand = command.slashCommand.toJSON();
    suite.plan(6);

    suite.is(slashCommand.name, 'next', 'registers as /next');
    suite.equal(slashCommand.options.length, 3, 'has area, sub-area, and public options');
    suite.is(slashCommand.options[0].name, 'area', 'supports an area option');
    suite.true(slashCommand.options[0].autocomplete, 'supports area autocomplete');
    suite.is(slashCommand.options[1].name, 'sub-area', 'supports a sub-area option');
    suite.is(slashCommand.options[2].name, 'public', 'supports public responses');
});

test('commands - next slash reply is ephemeral by default', async suite => {
    const interaction = makeInteraction(makeTimers(2), {});
    suite.plan(2);

    await command.interactionHandler(interaction);

    suite.equal(interaction.reply.firstCall.args[0].flags, MessageFlags.Ephemeral, 'defaults to an ephemeral reply');
    suite.equal((interaction.reply.firstCall.args[0].content.match(/^\*\*/gm) || []).length, 2, 'lists known timers');
});

test('commands - public next timer list is limited to ten entries', async suite => {
    const interaction = makeInteraction(makeTimers(12), { public: true });
    suite.plan(3);

    await command.interactionHandler(interaction);

    const response = interaction.reply.firstCall.args[0];
    suite.notOk(response.flags, 'does not set ephemeral flags for public response');
    suite.equal((response.content.match(/^\*\*/gm) || []).length, 10, 'includes at most ten timer areas');
    suite.true(response.content.includes('Showing the first 10 of 12 timer areas'), 'explains the limit');
});

test('commands - next autocomplete filters sub-areas by selected area', async suite => {
    const respond = sinon.stub().resolves();
    const interaction = {
        isAutocomplete: () => true,
        options: {
            getFocused: () => ({ name: 'sub-area', value: '' }),
            getString: () => 'sg',
        },
        client: { timers_list: makeTimers(2) },
        respond,
    };
    suite.plan(2);

    await command.autocompleteHandler(interaction);

    suite.true(respond.calledOnce, 'responds to autocomplete');
    suite.deepEqual(respond.firstCall.args[0], [{ name: 'sub-0', value: 'sub-0' }], 'only suggests sub-areas in selected area');
});

function makeInteraction(timers, { area = null, subArea = null, public: isPublic = false } = {}) {
    return {
        isChatInputCommand: () => true,
        options: {
            getString: name => name === 'area' ? area : subArea,
            getBoolean: () => isPublic,
        },
        client: { timers_list: timers },
        reply: sinon.stub().resolves(),
    };
}

function makeTimers(count) {
    return Array.from({ length: count }, (_, index) => {
        const area = index === 0 ? 'sg' : `area-${index}`;
        const subArea = index === 0 ? 'sub-0' : `sub-${index}`;
        return {
            getArea: () => area,
            getSubArea: () => subArea,
            getDemand: () => `${area} ${subArea} timer`,
            getNext: () => DateTime.utc().plus({ minutes: index + 5 }),
        };
    });
}
