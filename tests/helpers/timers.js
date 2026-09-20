// Provide an easy way to intercept calls to the hunter registry commands
import sinon from 'sinon';
import { getKnownTimersDetails, timerAliases, nextTimer, listRemind } from '../../src/modules/timer-helper.js';
const mhctTimers = { getKnownTimersDetails, timerAliases, nextTimer, listRemind };

export const stubTimerHelper = () => {
    return {
        getKnownTimersDetails: sinon.stub(mhctTimers, 'getKnownTimersDetails'),
        timerAliases: sinon.stub(mhctTimers, 'timerAliases'),
        nextTimer: sinon.stub(mhctTimers, 'nextTimer'),
        listRemind: sinon.stub(mhctTimers, 'listRemind'),
    };
};

export const restoreTimerHelper = ({ ...stubs }) => {
    Object.values(stubs).forEach(stub => stub.restore());
};

