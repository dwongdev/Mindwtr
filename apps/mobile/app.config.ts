import type { ConfigContext, ExpoConfig } from 'expo/config';

const isFossBuild = process.env.FOSS_BUILD === '1' || process.env.FOSS_BUILD === 'true';
const analyticsHeartbeatUrl = (process.env.ANALYTICS_HEARTBEAT_URL ?? '').trim();
const dropboxAppKey = (process.env.DROPBOX_APP_KEY ?? '').trim();

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  const extra = {
    ...(base.extra ?? {}),
    isFossBuild,
    analyticsHeartbeatUrl: isFossBuild ? '' : analyticsHeartbeatUrl,
    dropboxAppKey,
  };

  return {
    ...base,
    extra,
  };
};
