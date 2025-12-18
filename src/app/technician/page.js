"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

// 🔐 SECURITY VAULT: Define your users here
const AUTH_DB = [
  { id: 'raju', pass: '1234', name: 'Raju Mechanic', role: 'TECH' },
  { id: 'john', pass: '1234', name: 'John Doe', role: 'TECH' },
  { id: 'elec', pass: '1234', name: 'Electrical Specialist', role: 'TECH' },
  { id: 'help', pass: '1234', name: 'Helper 01', role: 'TECH' },
  { id: 'admin', pass: 'admin', name: 'Expert Team', role: 'SUPER_ADMIN' }
];

export default function TechnicianDashboard() {
  // LOGIN STATE
  const [user, setUser] = useState(null); // If null, show login screen
  const [inputID, setInputID] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // DATA STATE
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. LISTEN TO DATABASE (Always active, but only shown after login)
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc")); 
    const unsub = onSnapshot(q, (snapshot) => {
      const jobsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setJobs(jobsList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. LOGIN LOGIC
  const handleLogin = (e) => {
    e.preventDefault();
    // Find user in the "Vault"
    const foundUser = AUTH_DB.find(u => u.id === inputID.toLowerCase() && u.pass === inputPass);
    
    if (foundUser) {
      setUser(foundUser);
      setErrorMsg('');
    } else {
      setErrorMsg('❌ Invalid ID or Password');
    }
  };

  // 3. FILTER JOBS (The "Gatekeeper" Logic)
  const myJobs = user?.role === 'SUPER_ADMIN' 
    ? jobs // Admin sees everything
    : jobs.filter(job => job.technicianName === user?.name);

  // 4. UPDATE STATUS
  const updateStatus = async (jobId, newStatus) => {
    const jobRef = doc(db, "jobs", jobId);
    await updateDoc(jobRef, { status: newStatus });
  };

  // ================= VIEW 1: LOGIN SCREEN =================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <h1 className="text-3xl font-black text-center mb-2 text-blue-500">Technician<span className="text-white">Portal</span></h1>
          <p className="text-slate-400 text-center mb-8 text-sm">Secure Access Gateway</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-xs uppercase font-bold text-slate-500">User ID</label>
              <input 
                autoFocus
                type="text" 
                placeholder="e.g. raju" 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white outline-none focus:border-blue-500 transition-all"
                value={inputID}
                onChange={(e) => setInputID(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-xs uppercase font-bold text-slate-500">Password</label>
              <input 
                type="password" 
                placeholder="••••" 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white outline-none focus:border-blue-500 transition-all"
                value={inputPass}
                onChange={(e) => setInputPass(e.target.value)}
              />
            </div>

            {errorMsg && (
              <div className="text-red-400 text-sm text-center font-bold bg-red-900/20 p-2 rounded">
                {errorMsg}
              </div>
            )}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95">
              AUTHENTICATE 🔒
            </button>
          </form>

          <Link href="/" className="block text-center mt-6 text-slate-600 hover:text-slate-400 text-xs">
            ← Cancel
          </Link>
        </div>
      </div>
    );
  }

  // ================= VIEW 2: DASHBOARD (SECURE) =================
  if (loading) return <div className="min-h-screen bg-slate-900 text-white p-10">Loading System...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
      
      {/* Header */}
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-400">Operator: <span className="text-blue-500">{user.name}</span></h1>
          <p className="text-sm text-slate-500">Active Jobs: {myJobs.length}</p>
        </div>
        <button onClick={() => setUser(null)} className="bg-slate-800 border border-slate-600 px-4 py-2 rounded text-red-400 hover:bg-red-900/20 hover:text-red-300 text-xs font-bold transition-all">
          🔓 Logout
        </button>
      </div>

      {/* THE JOB GRID */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {myJobs.length === 0 && (
          <div className="col-span-full text-center py-20 bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-700">
            <h2 className="text-2xl font-bold text-slate-600 mb-2">No Assignments</h2>
            <p className="text-slate-500">You are free! Check with Supervisor.</p>
          </div>
        )}

        {myJobs.map((job) => (
          <div key={job.id} className={`flex flex-col relative p-6 rounded-2xl border-2 transition-all ${
            job.status === 'PENDING' ? 'border-orange-500/50 bg-slate-800/50' :
            job.status === 'WIP' ? 'border-blue-500 bg-slate-800 shadow-[0_0_20px_rgba(59,130,246,0.2)]' :
            'border-green-500/50 bg-slate-800/50 opacity-75'
          }`}>
            
            {/* Status Badge */}
            <div className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded uppercase ${
              job.status === 'PENDING' ? 'bg-orange-500/20 text-orange-400' :
              job.status === 'WIP' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
              'bg-green-500/20 text-green-400'
            }`}>
              {job.status}
            </div>

            <h2 className="text-2xl font-bold mb-1">{job.vehicleNumber}</h2>
            <p className="text-slate-400 text-sm mb-4 border-b border-slate-700 pb-4">
              {job.model} • <span className="text-blue-400">{job.jobType || 'Standard Job'}</span>
            </p>

            {/* Work Order */}
            <div className="flex-grow mb-6 bg-slate-900/50 p-4 rounded-lg">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Instructions:</h3>
              <p className="text-slate-300 whitespace-pre-line text-sm">
                {job.instructions || job.complaints || "No specific instructions."}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-auto">
              {job.status === 'PENDING' && (
                <button onClick={() => updateStatus(job.id, 'WIP')} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl active:scale-95 transition-all">
                  ▶ START JOB
                </button>
              )}
              {job.status === 'WIP' && (
                <button onClick={() => updateStatus(job.id, 'DONE')} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl active:scale-95 transition-all">
                  ⏹ FINISH JOB
                </button>
              )}
              {job.status === 'DONE' && (
                <div className="text-center text-green-500 font-mono text-sm py-3 bg-green-500/10 rounded-xl border border-green-500/20">
                  ✓ WAITING FOR QC
                </div>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}