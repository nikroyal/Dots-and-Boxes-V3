// ============================================================================
// FIREBASE SETUP — REPLACE EVERY VALUE BELOW
// ============================================================================
// 1. Go to https://console.firebase.google.com
// 2. Create a new project
// 3. Add a web app (the </> icon)
// 4. Create a `.env` file in the root directory using `.env.example` as a template.
// 5. Copy the firebaseConfig object Firebase shows and paste the values
//    into your `.env` file, replacing every YOUR_... placeholder.
// 6. Enable Authentication → Email/Password sign-in method
// 7. Create Firestore Database (production mode, paste firestore.rules)
//
// If you skip this step the app fails fast with a console error on load
// rather than silently using somebody else's backend.
// ============================================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};


// Fail loudly if the placeholder wasn't replaced. We check apiKey because
// it's the most visible value and the one that's hardest to forget.
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
  const msg =
    'Firebase is not configured. Create a .env file and paste your own ' +
    'Firebase project config. See the comment at the ' +
    'top of src/lib/firebase.js for steps.';
  // Surface in the UI so a non-developer deployer sees it too.
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const container = document.createElement('div');
      container.style.fontFamily = 'system-ui';
      container.style.padding = '40px';
      container.style.maxWidth = '600px';
      container.style.margin = '0 auto';
      container.style.lineHeight = '1.6';

      const heading = document.createElement('h1');
      heading.style.color = '#B91C3C';
      heading.textContent = 'Firebase not configured';

      const paragraph = document.createElement('p');
      paragraph.textContent = msg;

      container.appendChild(heading);
      container.appendChild(paragraph);

      document.body.innerHTML = '';
      document.body.appendChild(container);
    });
  }
  throw new Error(msg);
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
