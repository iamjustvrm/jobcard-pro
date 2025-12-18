"use client";
import { useState } from 'react';
import { auth } from './firebase'; // Make sure this path points to your firebase.js
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // If successful, send them to the Dashboard
      router.push('/'); 
    } catch (err) {
      console.error(err);
      setError('Invalid Email or Password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">JobCard Pro</h1>
          <p className="text-slate-400">Workshop Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Email Input */}
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-2">Email Access ID</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-slate-500" size={20} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 text-white p-3 pl-10 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="admin@workshop.com"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-2">Secure Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-500" size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 text-white p-3 pl-10 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {/* Error Message Area */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded text-sm text-center">
              {error}
            </div>
          )}

          {/* Login Button */}
          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95"
          >
            Authenticate Access
          </button>

        </form>
      </div>
    </div>
  );
}