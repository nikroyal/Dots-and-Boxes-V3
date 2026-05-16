// ============================================================================
// FIREBASE SETUP — REPLACE EVERY VALUE BELOW
// ============================================================================
// 1. Go to https://console.firebase.google.com
// 2. Create a new project
// 3. Add a web app (the </> icon)
// 4. Copy the firebaseConfig object Firebase shows and paste the values
//    below, replacing every YOUR_... placeholder.
// 5. Enable Authentication → Email/Password sign-in method
// 6. Create Firestore Database (production mode, paste firestore.rules)
//
// If you skip this step the app fails fast with a console error on load
// rather than silently using somebody else's backend.
// ============================================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Fail loudly if the placeholder wasn't replaced. We check apiKey because
// it's the most visible value and the one that's hardest to forget.
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
  const msg =
    'firebase.js still has placeholder values. Open src/lib/firebase.js ' +
    'and paste your own Firebase project config. See the comment at the ' +
    'top of that file for steps.';
  // Surface in the UI so a non-developer deployer sees it too.
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML =
        '<div style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; line-height: 1.6;">' +
        '<h1 style="color: #B91C3C;">Firebase not configured</h1>' +
        '<p>' + msg + '</p>' +
        '</div>';
    });
  }
  throw new Error(msg);
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
