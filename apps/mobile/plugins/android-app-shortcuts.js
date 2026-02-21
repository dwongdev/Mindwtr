const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const MAIN_ACTIVITY_SUFFIX = '.MainActivity';
const SHORTCUTS_RESOURCE = '@xml/mindwtr_shortcuts';
const SHORTCUTS_FILE_NAME = 'mindwtr_shortcuts.xml';

const SHORTCUTS_XML = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutId="add_task_inbox"
    android:shortcutLongLabel="Add task to Inbox"
    android:shortcutShortLabel="Add task">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="mindwtr:///capture-quick?mode=text" />
  </shortcut>
  <shortcut
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutId="open_focus"
    android:shortcutLongLabel="Open Focus view"
    android:shortcutShortLabel="Focus">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="mindwtr:///focus" />
  </shortcut>
  <shortcut
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutId="open_calendar"
    android:shortcutLongLabel="Open Calendar view"
    android:shortcutShortLabel="Calendar">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="mindwtr:///calendar" />
  </shortcut>
</shortcuts>
`;

const isMainActivity = (activityName) =>
  typeof activityName === 'string' && activityName.endsWith(MAIN_ACTIVITY_SUFFIX);

module.exports = function withAndroidAppShortcuts(config) {
  const withManifest = withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application || !Array.isArray(application.activity)) {
      return cfg;
    }

    const mainActivity = application.activity.find((activity) =>
      isMainActivity(activity?.$?.['android:name'])
    );
    if (!mainActivity) {
      return cfg;
    }

    if (!Array.isArray(mainActivity['meta-data'])) {
      mainActivity['meta-data'] = [];
    }

    const existingShortcutsMeta = mainActivity['meta-data'].find(
      (meta) => meta?.$?.['android:name'] === 'android.app.shortcuts'
    );
    if (existingShortcutsMeta?.$) {
      existingShortcutsMeta.$['android:resource'] = SHORTCUTS_RESOURCE;
      return cfg;
    }

    mainActivity['meta-data'].push({
      $: {
        'android:name': 'android.app.shortcuts',
        'android:resource': SHORTCUTS_RESOURCE,
      },
    });

    return cfg;
  });

  return withDangerousMod(withManifest, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(path.join(xmlDir, SHORTCUTS_FILE_NAME), SHORTCUTS_XML, 'utf8');
      return cfg;
    },
  ]);
};
