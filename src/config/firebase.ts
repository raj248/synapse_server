import { initializeApp, cert, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp({
    credential: cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!),
  });
}
