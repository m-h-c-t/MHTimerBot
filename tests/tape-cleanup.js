import { test } from 'tape';
import sinon from 'sinon';

test.onFinish(() => {
    console.log('Removing all spies & restoring all mocks');
    sinon.restore();
});
