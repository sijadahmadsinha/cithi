import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ==========================================
// ফায়ারবেস কনফিগারেশন (Firebase Configuration)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBxJyE-35jwKDcYbac1ICqLCC6AgdJd4CQ",
  authDomain: "cithi-3ef6b.firebaseapp.com",
  projectId: "cithi-3ef6b",
  storageBucket: "cithi-3ef6b.firebasestorage.app",
  messagingSenderId: "638478863538",
  appId: "1:638478863538:web:0cdccebaa3534eece58dab",
  measurementId: "G-Z05VK1FENP"
};

// Next.js সার্ভার/ক্লায়েন্ট উভয় ক্ষেত্রেই নিরাপদে ইনিশিয়ালাইজ করার জন্য:
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// গোপন চাবিকাঠি (Secret Admin Password)
const ADMIN_PASSWORD = "sijadahmad98";

export { db, ADMIN_PASSWORD };
