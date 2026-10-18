import test from 'tape';
import sinon from 'sinon';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';

import { command as findMouse } from '../../src/commands/find.js';
import { command as findLoot } from '../../src/commands/ifind.js';
import { command as minluck } from '../../src/commands/minluck.js';
import { command as price } from '../../src/commands/price.js';
import { command as remind } from '../../src/commands/remind.js';
import { command as schedule } from '../../src/commands/schedule.js';
import { command as whatsin } from '../../src/commands/whatsin.js';

test('slash commands - all commands have optional public response option', suite => {
    const commands = [findMouse, findLoot, minluck, price, remind, schedule, whatsin];
    suite.plan(commands.length * 2);

    for (const command of commands) {
        const publicOption = command.slashCommand.toJSON().options.find(option => option.name === 'public');
        suite.ok(publicOption, `${command.name} has a public option`);
        suite.equal(publicOption.type, ApplicationCommandOptionType.Boolean, `${command.name} public option is boolean`);
    }
});

test('slash command - price defaults to private and can be public', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        options: {
            getString: () => 'unknown item',
            getBoolean: () => false,
        },
        reply: sinon.stub().resolves(),
    };
    suite.plan(2);

    await price.interactionHandler(interaction);
    suite.equal(interaction.reply.firstCall.args[0].flags, MessageFlags.Ephemeral, 'defaults to ephemeral');

    interaction.options.getBoolean = () => true;
    await price.interactionHandler(interaction);
    suite.notOk(interaction.reply.secondCall.args[0].flags, 'public option omits ephemeral flags');
});

test('slash command - minluck defaults to private and can be public', async suite => {
    const interaction = {
        isChatInputCommand: () => true,
        id: 'interaction-id',
        user: { id: 'user-id' },
        options: {
            getString: name => name === 'mouse' ? 'unknown mouse' : '*',
            getBoolean: () => false,
        },
        client: { nicknames: { get: () => ({}) } },
        channel: {
            createMessageComponentCollector: () => ({ on: sinon.stub() }),
        },
        reply: sinon.stub().resolves(),
        editReply: sinon.stub().resolves(),
    };
    suite.plan(3);

    await minluck.interactionHandler(interaction);
    suite.equal(interaction.reply.firstCall.args[0].flags, MessageFlags.Ephemeral, 'defaults to ephemeral');
    suite.notOk(interaction.reply.firstCall.args[0].components, 'does not attach a share button');

    interaction.options.getBoolean = () => true;
    await minluck.interactionHandler(interaction);
    suite.notOk(interaction.reply.secondCall.args[0].flags, 'public option omits ephemeral flags');
});
