const { withAndroidManifest } = require('@expo/config-plugins');

const MLKIT_ACTIVITY = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

module.exports = function withAndroidManifestFixes(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    if (!manifest.manifest.$) {
      manifest.manifest.$ = {};
    }
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = manifest.manifest.application?.[0];
    if (!application?.activity) {
      return config;
    }

    application.activity.forEach((activity) => {
      if (activity.$ && activity.$['android:name'] === MLKIT_ACTIVITY) {
        // Remove/override forced orientation for large screens.
        activity.$['android:screenOrientation'] = 'unspecified';
        const existing = activity.$['tools:replace'];
        if (existing) {
          activity.$['tools:replace'] = Array.isArray(existing)
            ? [...existing, 'android:screenOrientation']
            : `${existing},android:screenOrientation`;
        } else {
          activity.$['tools:replace'] = 'android:screenOrientation';
        }
      }
    });

    return config;
  });
};
