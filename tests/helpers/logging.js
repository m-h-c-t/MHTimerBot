// Provide an easy way for test suites to intercept calls to the logging library.
// To use, a suite can store the result of calling `stubLogger` in a setup "test",
// and then pass this result to `restoreLogger` in a cleanup "test".
import sinon from 'sinon';
import {Logger} from '../../src/modules/logger.js';

export const stubLogger = () => {
    return {
        log: sinon.stub(Logger, 'log'),
        warn: sinon.stub(Logger, 'warn'),
        error: sinon.stub(Logger, 'error'),
    };
};
export const restoreLogger = ({ ...stubs }) => {
    Object.values(stubs).forEach(stub => stub.restore());
};

