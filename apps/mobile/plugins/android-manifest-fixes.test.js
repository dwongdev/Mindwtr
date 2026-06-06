import { describe, expect, it } from 'vitest';

const plugin = require('./android-manifest-fixes');

const {
  buildContextIntentFilter,
  ensureContextAutomationHeadlessService,
  ensureContextAutomationReceiver,
  removeContextIntentFilters,
} = plugin.__testables;

describe('android-manifest-fixes', () => {
  it('moves context automation custom actions from MainActivity to a receiver', () => {
    const mainActivity = {
      $: { 'android:name': '.MainActivity' },
      'intent-filter': [
        buildContextIntentFilter(),
        buildContextIntentFilter({ dataScheme: 'mindwtr' }),
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        },
      ],
    };
    const application = {
      activity: [mainActivity],
    };

    removeContextIntentFilters(mainActivity);
    ensureContextAutomationReceiver(application);
    ensureContextAutomationHeadlessService(application);

    expect(mainActivity['intent-filter']).toHaveLength(1);
    expect(mainActivity['intent-filter'][0].action[0].$['android:name']).toBe('android.intent.action.VIEW');

    expect(application.receiver).toHaveLength(1);
    expect(application.receiver[0].$).toEqual({
      'android:name': '.ContextAutomationReceiver',
      'android:exported': 'true',
    });
    expect(application.receiver[0]['intent-filter']).toHaveLength(2);

    expect(application.service).toHaveLength(1);
    expect(application.service[0].$).toEqual({
      'android:name': '.ContextAutomationHeadlessService',
      'android:exported': 'false',
    });
  });
});
