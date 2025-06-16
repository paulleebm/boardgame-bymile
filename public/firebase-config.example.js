// Firebase configuration placeholder
// Copy this file to firebase-config.js and fill in your project credentials.

// Replace the values below with your Firebase project's configuration.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase compat libraries are loaded in index.html. Use them to initialize
// the global firebase object.
firebase.initializeApp(firebaseConfig);
window.firebaseInitialized = true;
