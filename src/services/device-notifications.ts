import { Capacitor, type PermissionState } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Notification } from '../types'

const CHANNEL_ID = 'family-updates'

export type DeviceNotificationPermission = PermissionState | 'default' | 'unsupported'

function isNativeApp() {
  return Capacitor.isNativePlatform()
}

async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== 'android') return

  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Family updates',
    description: 'Notifications about family announcements and account updates',
    importance: 4,
    visibility: 1,
  })
}

export async function getNotificationPermission(): Promise<DeviceNotificationPermission> {
  if (isNativeApp()) {
    const { display } = await LocalNotifications.checkPermissions()
    return display
  }

  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export async function requestNotificationPermission(): Promise<DeviceNotificationPermission> {
  if (isNativeApp()) {
    const { display } = await LocalNotifications.requestPermissions()
    if (display === 'granted') await ensureAndroidChannel()
    return display
  }

  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.requestPermission()
}

function notificationId(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  }
  return (hash >>> 0) % 2147483647 || 1
}

export async function showDeviceNotification(title: string, body: string, id: string) {
  if (isNativeApp()) {
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') return

    await ensureAndroidChannel()
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(id),
        title,
        body,
        channelId: CHANNEL_ID,
        foreground: true,
        isExactNotification: false,
        schedule: { at: new Date(Date.now() + 250) },
        extra: { path: '/notifications' },
      }],
    })
    return
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icons/icon-192x192.png' })
  }
}

export async function showRealtimeNotification(notification: Notification) {
  await showDeviceNotification(
    notification.title,
    notification.message,
    notification.notification_id,
  )
}
