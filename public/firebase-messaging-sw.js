import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

// Initialize the Firebase app in the service worker
// The values here will be replaced by the build process or should be hardcoded if needed
const firebaseConfig = {
  apiKey: "AIzaSyB9D7Lz27Rka-NkNM9zHwlGm_xUXfSas6A",
  authDomain: "remindrx-1.firebaseapp.com",
  projectId: "remindrx-1",
  storageBucket: "remindrx-1.firebasestorage.app",
  messagingSenderId: "291415925475",
  appId: "1:291415925475:web:d6d677a29665af2a871bd6"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/Cropped.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
