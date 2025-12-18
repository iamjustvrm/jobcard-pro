// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // <--- This was likely missing or not exported
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// REPLACE THIS WITH YOUR ACTUAL KEYS FROM FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyABU9hGmX-N0ydET1Gkpdp0SeoQ8W8ZS_c",
    authDomain: "jobcard-pro-db.firebaseapp.com",
    projectId: "jobcard-pro-db",
    storageBucket: "jobcard-pro-db.firebasestorage.app",
    messagingSenderId: "82008102906",
    appId: "1:82008102906:web:618649abddf32b9798b643",
    measurementId: "G-7VV4Y7BF7W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services & EXPORT them so other pages can use them
export const db = getFirestore(app);       // <--- THE MISSING EXPORT
export const auth = getAuth(app);          // Ready for later
export const storage = getStorage(app);    // Ready for images