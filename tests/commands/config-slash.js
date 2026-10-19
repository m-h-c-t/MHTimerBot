import test from 'tape';
import sinon from 'sinon';
import { MessageFlags, PermissionsBitField } from 'discord.js';

import { command as config } from '../../src/commands/config.js';
import { mockMember } from '../helpers/mock-member.js';

function makeInteraction(isPublic) {
    const member = mockMember();
    member.permissions.has.withArgs(PermissionsBitField.Flags.Administrator).returns(true);
    member.client.settings.guilds[member.guild.id].emoji = Object.fromEntries(
        Array.from({ length: 60 }, (_, index) => [`emoji-${index}`, 'x'.repeat(40)]),
    );

    return {
        isChatInputCommand: () => true,
        guild: member.guild,
        member,
        client: member.client,
        options: {
            getSubcommand: () => 'emoji',
            getBoolean: () => isPublic,
        },
        reply: sinon.stub().resolves(),
        followUp: sinon.stub().resolves(),
    };
}

test('slash command - config defaults to private and sends complete untruncated output', async suite => {
    const interaction = makeInteraction(false);
    suite.plan(4);

    await config.interactionHandler(interaction);

    suite.equal(interaction.reply.firstCall.args[0].flags, MessageFlags.Ephemeral, 'defaults to ephemeral');
    suite.ok(interaction.followUp.called, 'sends remaining message chunks as follow-ups');
    const responses = [
        interaction.reply.firstCall.args[0].content,
        ...interaction.followUp.args.map(([response]) => response.content),
    ];
    suite.ok(responses.every(response => response.length <= 2000), 'each response respects Discord length limits');
    suite.ok(responses.join('\n').includes('emoji-59 - '), 'includes the final configured emoji');
});

test('slash command - config can be public without truncating output', async suite => {
    const interaction = makeInteraction(true);
    suite.plan(3);

    await config.interactionHandler(interaction);

    suite.notOk(interaction.reply.firstCall.args[0].flags, 'public option omits ephemeral flags');
    suite.ok(interaction.followUp.called, 'sends remaining message chunks as follow-ups');
    const responses = [
        interaction.reply.firstCall.args[0].content,
        ...interaction.followUp.args.map(([response]) => response.content),
    ];
    suite.ok(responses.join('\n').includes('emoji-59 - '), 'includes the final configured emoji');
});
