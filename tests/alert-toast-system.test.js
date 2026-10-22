import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trovaAlert,
  registerAlertDispatcher,
} from '../src/context/AlertContext.js';
import {
  trovaToast,
  registerToastDispatcher,
} from '../src/context/ToastContext.js';

test('trovaAlert dispatches to registered dispatcher with normalized payload', () => {
  let captured = null;
  const unregister = registerAlertDispatcher((payload) => {
    captured = payload;
  });

  trovaAlert('Test Title', 'Test Message', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'default' },
  ]);

  assert.ok(captured, 'Alert should be captured by registered dispatcher');
  assert.equal(captured.title, 'Test Title');
  assert.equal(captured.message, 'Test Message');
  assert.equal(captured.buttons.length, 2);
  assert.equal(captured.buttons[0].text, 'Cancel');

  unregister();
});

test('trovaToast dispatches success, error, warning, and info correctly', () => {
  const events = [];
  const unregister = registerToastDispatcher((toast) => {
    events.push(toast);
  });

  trovaToast.success('Saved to Watchlist', { title: 'LIBRARY', haptic: false });
  trovaToast.error('Network Error');
  trovaToast.warning('Low Seeders');
  trovaToast.info('Playback Started');

  assert.equal(events.length, 4);

  assert.equal(events[0].type, 'success');
  assert.equal(events[0].message, 'Saved to Watchlist');
  assert.equal(events[0].title, 'LIBRARY');
  assert.equal(events[0].icon, 'checkmark-circle-outline');
  assert.equal(events[0].haptic, false);

  assert.equal(events[1].type, 'error');
  assert.equal(events[1].message, 'Network Error');
  assert.equal(events[1].icon, 'alert-circle-outline');

  assert.equal(events[2].type, 'warning');
  assert.equal(events[2].message, 'Low Seeders');

  assert.equal(events[3].type, 'info');
  assert.equal(events[3].message, 'Playback Started');

  unregister();
});

test('trovaToast dismiss sends null toast data', () => {
  let captured = 'init';
  const unregister = registerToastDispatcher((toast) => {
    captured = toast;
  });

  trovaToast.dismiss();
  assert.equal(captured, null);

  unregister();
});
