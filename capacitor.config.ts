import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.familyforever.app',
  appName: '2021familyforever',
  webDir: 'dist',
  server: {
    url: 'https://2021familyforever-version-2-0-1.felisanod.workers.dev/',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#16834b',
    },
  },
}

export default config
