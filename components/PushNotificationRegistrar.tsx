'use client'

import { useEffect } from 'react'

export default function PushNotificationRegistrar() {
  useEffect(() => {
    let disposed = false
    const listenerCleanupTasks: Array<() => void | Promise<void>> = []

    async function registerPushToken() {
      try {
        const [{ Capacitor }, { PushNotifications }] = await Promise.all([
          import('@capacitor/core'),
          import('@capacitor/push-notifications'),
        ])

        if (!Capacitor.isNativePlatform()) return

        const permission = await PushNotifications.checkPermissions()
        const granted =
          permission.receive === 'granted'
            ? permission
            : await PushNotifications.requestPermissions()

        if (disposed || granted.receive !== 'granted') return

        const registrationListener = await PushNotifications.addListener('registration', async (token) => {
          if (disposed || !token.value) return
          await fetch('/api/admin/push-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: token.value,
              platform: Capacitor.getPlatform(),
            }),
          }).catch((error) => {
            console.warn('[push] failed to save token', error)
          })
        })
        listenerCleanupTasks.push(() => registrationListener.remove())

        const registrationErrorListener = await PushNotifications.addListener('registrationError', (error) => {
          console.warn('[push] registration failed', error)
        })
        listenerCleanupTasks.push(() => registrationErrorListener.remove())

        const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          const url = event.notification.data?.url
          if (typeof url === 'string' && url.startsWith('/')) {
            window.location.href = url
          }
        })
        listenerCleanupTasks.push(() => actionListener.remove())

        await PushNotifications.register()
      } catch (error) {
        console.warn('[push] unavailable', error)
      }
    }

    registerPushToken()

    return () => {
      disposed = true
      for (const cleanup of listenerCleanupTasks) {
        void cleanup()
      }
    }
  }, [])

  return null
}
