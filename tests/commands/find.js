import test from 'tape';
import sinon from 'sinon';

import { mockMessage } from '../helpers/mock-message.js';
import { command } from '../../src/commands/find.js';

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
