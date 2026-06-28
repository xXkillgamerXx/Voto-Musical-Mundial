/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDkPn1mXsJ0h32uwdImbv5gR9XpD9sgQWE',
  authDomain: 'votos-3420a.firebaseapp.com',
  databaseURL: 'https://votos-3420a-default-rtdb.firebaseio.com',
  projectId: 'votos-3420a',
  storageBucket: 'votos-3420a.firebasestorage.app',
  messagingSenderId: '927668152816',
  appId: '1:927668152816:web:73205cba757f9553acd535',
  measurementId: 'G-TPJGWP4Q2X',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {}
  const data = payload.data || {}
  const title = notification.title || data.title || 'Votos Mundial'

  self.registration.showNotification(title, {
    body: notification.body || data.body || 'Tienes una nueva notificacion.',
    ...(notification.icon || data.icon ? { icon: notification.icon || data.icon } : {}),
    ...(data.badge ? { badge: data.badge } : {}),
    data: {
      url: data.url || '/',
    },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(targetUrl))
})
