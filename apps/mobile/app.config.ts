import type { ConfigContext, ExpoConfig } from 'expo/config';

const isFossBuild = process.env.FOSS_BUILD === '1' || process.env.FOSS_BUILD === 'true';

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  const extra = {
    ...(base.extra ?? {}),
    isFossBuild,
  };

  return {
    ...base,
    extra,
  };
};
