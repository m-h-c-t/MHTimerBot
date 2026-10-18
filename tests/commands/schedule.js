import test from 'tape';
import sinon from 'sinon';
import { DateTime } from 'luxon';

import { command } from '../../src/commands/schedule.js';

test('commands - schedule slash command registration', suite => {
    const slashCommand = command.slashCommand.toJSON();
    suite.plan(7);

    suite.is(slashCommand.name, 'schedule', 'registers as /schedule');
    suite.equal(slashCommand.options.length, 3, 'has area, sub-area, and hours options');
    suite.is(slashCommand.options[0].name, 'area', 'filters by area');
    suite.true(slashCommand.options[0].autocomplete, 'supports area autocomplete');
    suite.is(slashCommand.options[1].name, 'sub-area', 'filters by sub-area');
    suite.true(slashCommand.options[1].autocomplete, 'supports sub-area autocomplete');
    suite.equal(slashCommand.options[2].type, 4, 'accepts an integer hours value');
});

test('commands - schedule filters by area and sub-area', async suite => {
    const timers = [
        makeTimer('sg', 'winter', 'Winter timer'),
        makeTimer('sg', 'summer', 'Summer timer'),
    ];
    const interaction = {
        isChatInputCommand: () => true,
        options: {
            getString: sinon.stub().callsFake(name => ({
                area: 'sg',
                'sub-area': 'winter',
            })[name] || null),
            getInteger: sinon.stub().returns(4),
        },
        client: { timers_list: timers },
        reply: sinon.stub().resolves(),
    };
    suite.plan(3);

    await command.interactionHandler(interaction);

    suite.true(interaction.reply.calledOnce, 'replies to the slash command');
    const response = interaction.reply.firstCall.args[0].content;
    suite.true(response.includes('Winter timer'), 'includes the selected sub-area timer');
    suite.false(response.includes('Summer timer'), 'excludes other sub-area timers');
});

test('commands - schedule autocomplete filters sub-areas by selected area', async suite => {
    const respond = sinon.stub().resolves();
    const interaction = {
        isAutocomplete: () => true,
        options: {
            getFocused: () => ({ name: 'sub-area', value: '' }),
            getString: () => 'sg',
        },
        client: {
            timers_list: [
                makeTimer('sg', 'winter', 'Winter timer'),
                makeTimer('fg', 'close', 'Close timer'),
            ],
        },
        respond,
    };
    suite.plan(2);

    await command.autocompleteHandler(interaction);

    suite.true(respond.calledOnce, 'responds to the autocomplete request');
    suite.deepEqual(respond.firstCall.args[0], [{ name: 'winter', value: 'winter' }], 'offers only sub-areas in the selected area');
});

function makeTimer(area, subArea, message) {
    return {
        getArea: () => area,
        getSubArea: () => subArea,
        getDemand: () => message,
        isSilent: () => false,
        upcoming: until => [DateTime.utc().plus({ minutes: 1 }).startOf('minute')].filter(time => time < until),
    };
}
