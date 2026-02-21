const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const MAIN_ACTIVITY_SUFFIX = '.MainActivity';
const SHORTCUTS_RESOURCE = '@xml/mindwtr_shortcuts';
const SHORTCUTS_FILE_NAME = 'mindwtr_shortcuts.xml';
const SHORTCUTS_STRINGS_FILE_NAME = 'mindwtr_shortcuts_strings.xml';

const SHORTCUTS_XML = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutId="add_task_inbox"
    android:shortcutLongLabel="@string/shortcut_add_task_long"
    android:shortcutShortLabel="@string/shortcut_add_task_short">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="mindwtr:///capture-quick?mode=text" />
  </shortcut>
  <shortcut
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutId="open_focus"
    android:shortcutLongLabel="@string/shortcut_open_focus_long"
    android:shortcutShortLabel="@string/shortcut_open_focus_short">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="mindwtr:///focus" />
  </shortcut>
  <shortcut
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutId="open_calendar"
    android:shortcutLongLabel="@string/shortcut_open_calendar_long"
    android:shortcutShortLabel="@string/shortcut_open_calendar_short">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="mindwtr:///calendar" />
  </shortcut>
</shortcuts>
`;

const SHORTCUTS_STRINGS_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="shortcut_add_task_long" translatable="false">Add task to Inbox</string>
  <string name="shortcut_add_task_short" translatable="false">Add task</string>
  <string name="shortcut_open_focus_long" translatable="false">Open Focus view</string>
  <string name="shortcut_open_focus_short" translatable="false">Focus</string>
  <string name="shortcut_open_calendar_long" translatable="false">Open Calendar view</string>
  <string name="shortcut_open_calendar_short" translatable="false">Calendar</string>
</resources>
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
      const valuesDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'values');
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.mkdir(valuesDir, { recursive: true });
      await fs.promises.writeFile(path.join(xmlDir, SHORTCUTS_FILE_NAME), SHORTCUTS_XML, 'utf8');
      await fs.promises.writeFile(path.join(valuesDir, SHORTCUTS_STRINGS_FILE_NAME), SHORTCUTS_STRINGS_XML, 'utf8');
      return cfg;
    },
  ]);
};
