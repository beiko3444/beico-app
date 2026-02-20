import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beiko.app',
  appName: 'BEIKO',
  webDir: 'public',
  server: {
    url: 'https://www.beiko.co.kr',
    cleartext: true
  }
};

export default config;
