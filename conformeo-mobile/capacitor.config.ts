import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.michelgermanotti.conformeo',
  appName: 'conformeo-mobile',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;
