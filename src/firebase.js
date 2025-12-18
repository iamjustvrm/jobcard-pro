// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- PASTE YOUR CONFIG HERE ---
const firebaseConfig = {
    apiKey: "AIzaSyABU9hGmX-N0ydET1Gkpdp0SeoQ8W8ZS_c",
    authDomain: "jobcard-pro-db.firebaseapp.com",
    projectId: "jobcard-pro-db",
    storageBucket: "jobcard-pro-db.firebasestorage.app",
    messagingSenderId: "82008102906",
    appId: "1:82008102906:web:618649abddf32b9798b643",
    measurementId: "G-7VV4Y7BF7W"
};
// ------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);