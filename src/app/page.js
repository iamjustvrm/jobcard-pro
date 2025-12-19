"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase'; // This links to the file we fixed yesterday

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false); // Toggle for Signup mode

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        // --- REGISTER NEW USER ---
        await createUserWithEmailAndPassword(auth, email, password);
        alert("✅ Account Created! Now logging you in...");
      }
      
      // --- LOGIN USER ---
      await signInWithEmailAndPassword(auth, email, password);
      
      // --- SMART ROUTING ---
      // If email has 'admin', go to Supervisor. Else go to Technician.
      if (email.includes('admin')) {
        router.push('/supervisor');
      } else {
        router.push('/technician');
      }

    } catch (err) {
      // Friendly Error Messages
      if (err.code === 'auth/invalid-credential') setError("❌ Wrong Email or Password.");
      else if (err.code === 'auth/weak-password') setError("⚠️ Password should be at least 6 characters.");
      else if (err.code === 'auth/email-already-in-use') setError("⚠️ This email is already registered.");
      else setError("❌ Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
        
        {/* BRANDING */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-blue-500 tracking-tighter">
            JOB<span className="text-white">CARD</span> <span className="text-sm text-slate-500 block mt-1">PRO</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">Secure Workshop Management</p>
        </div>

        {/* FORM */}
        <form onSubmit={handleAuth} className="space-y-6">
          
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
            <input 
              type="email" 
              required 
              placeholder="e.g. admin@workshop.com" 
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 mt-2 text-white focus:border-blue-500 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
            <input 
              type="password" 
              required 
              placeholder="••••••" 
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 mt-2 text-white focus:border-blue-500 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm text-center font-bold animate-pulse">{error}</div>}

          <button 
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${isRegistering ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:opacity-50`}
          >
            {loading ? 'Processing...' : (isRegistering ? 'CREATE ACCOUNT' : 'SECURE LOGIN')}
          </button>

        </form>

        {/* TOGGLE MODE */}
        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-slate-500 text-xs hover:text-white underline transition-colors"
          >
            {isRegistering ? "Already have an account? Login" : "Need to register staff? Create Account"}
          </button>
        </div>

      </div>
    </div>
  );
}