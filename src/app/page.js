"use client";
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase'; // Import auth and db
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Check User Role in Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // 3. Redirect based on Role
        if (userData.role === 'admin') {
          router.push('/admin'); // Go to Executive Suite
        } else if (userData.role === 'supervisor') {
          router.push('/supervisor'); // Go to Floor Dashboard
        } else {
          router.push('/technician'); // Go to Tech Portal
        }
      } else {
        // Fallback if no role defined (e.g., old admin account)
        if(email.includes('admin')) router.push('/admin');
        else router.push('/technician');
      }

    } catch (err) {
      setError('Invalid Credentials. Access Denied.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-blue-500 tracking-tighter">JOB<span className="text-white">CARD</span></h1>
          <p className="text-slate-400 text-sm mt-2">Workshop Operating System</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-500 text-sm p-3 rounded mb-4 text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase">Operator ID (Email)</label>
            <input 
              type="email" 
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="user@workshop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase">Passcode</label>
            <input 
              type="password" 
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg shadow-lg transition-transform transform hover:-translate-y-1"
          >
            INITIALIZE SYSTEM
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-700 pt-4">
           <p className="text-slate-500 text-xs">
             Restricted Access. Authorized Personnel Only.
           </p>
           {/* REGISTRATION LINK REMOVED FOR SECURITY */}
        </div>
      </div>
    </div>
  );
}