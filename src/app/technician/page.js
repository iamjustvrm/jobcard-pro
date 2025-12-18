"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

// 🔐 AUTH DATABASE
const AUTH_DB = [
  { id: 'raju', pass: '1234', name: 'Raju Mechanic', role: 'TECH' },
  { id: 'john', pass: '1234', name: 'John Doe', role: 'TECH' },
  { id: 'admin', pass: 'admin', name: 'Admin', role: 'SUPER_ADMIN' }
];

export default function TechnicianDashboard() {
  const [user, setUser] = useState(null);
  const [inputID, setInputID] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [jobs, setJobs] = useState([]);
  
  // LOGIN
  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = AUTH_DB.find(u => u.id === inputID.toLowerCase() && u.pass === inputPass);
    if (foundUser) setUser(foundUser);
    else alert("Invalid Credentials");
  };

  // FETCH JOBS
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc")); 
    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // 🛡️ DATA ADAPTER (Prevents Crashes on old data)
  const getSafeBlocks = (job) => {
    if (Array.isArray(job.blocks)) return job.blocks;
    if (typeof job.blocks === 'object' && job.blocks !== null) {
      return [
        { name: 'Mechanical', status: job.blocks.mechanical || 'PENDING', steps: [] },
        { name: 'Electrical', status: job.blocks.electrical || 'PENDING', steps: [] },
        { name: 'QC', status: job.blocks.qc || 'PENDING', steps: [] }
      ];
    }
    return [];
  };

  const markBlockDone = async (job, blockIndex) => {
    let updatedBlocks = getSafeBlocks(job);
    updatedBlocks[blockIndex].status = 'DONE';
    await updateDoc(doc(db, "jobs", job.id), { blocks: updatedBlocks });
  };

  // --- VIEW 1: LOGIN (WITH EXIT BUTTON) ---
  if (!user) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
        <h1 className="text-3xl font-black text-center text-blue-500 mb-8">TECH<span className="text-white">PORTAL</span></h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input autoFocus type="text" placeholder="User ID (raju)" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white" value={inputID} onChange={(e) => setInputID(e.target.value)} />
          <input type="password" placeholder="Password (1234)" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white" value={inputPass} onChange={(e) => setInputPass(e.target.value)} />
          <button className="w-full bg-blue-600 py-4 rounded-xl font-bold hover:bg-blue-500 transition-all">LOGIN</button>
        </form>
        
        {/* --- ADDED EXIT BUTTON HERE --- */}
        <div className="mt-8 pt-6 border-t border-slate-700 text-center">
          <Link href="/" className="text-slate-400 hover:text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors">
            ⬅ Exit to Main Dashboard
          </Link>
        </div>
      </div>
    </div>
  );

  // --- VIEW 2: DIAGNOSTIC DASHBOARD (UNCHANGED) ---
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans pb-20">
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div>
           <h1 className="text-lg font-bold text-slate-400">Operator: <span className="text-blue-500">{user.name}</span></h1>
           <p className="text-[10px] text-yellow-500">DIAGNOSTIC MODE ACTIVE</p>
        </div>
        <button onClick={() => setUser(null)} className="bg-slate-800 px-3 py-1 rounded text-red-400 text-xs font-bold border border-slate-600 hover:bg-slate-700">Logout</button>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {jobs.length === 0 && <div className="text-center text-slate-500 py-10">Database is empty. No jobs found.</div>}

        {jobs.map((job) => {
          const blocks = getSafeBlocks(job);
          // DIAGNOSTIC CHECK: Does the job belong to me?
          const isMyJob = job.technicianName === user.name || user.role === 'SUPER_ADMIN';
          const assignmentText = job.technicianName ? job.technicianName : "UNASSIGNED";

          return (
            <div key={job.id} className={`bg-slate-800 rounded-2xl border-2 overflow-hidden shadow-xl ${isMyJob ? 'border-blue-500' : 'border-slate-700 opacity-60'}`}>
              
              {/* HEADER */}
              <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-start">
                 <div>
                   <h2 className="text-2xl font-black font-mono text-white">{job.regNo || job.vehicleNumber}</h2>
                   <p className="text-slate-400 text-sm">{job.model} • {job.serviceType}</p>
                   
                   {/* DIAGNOSTIC LABEL */}
                   {!isMyJob && (
                     <div className="mt-2 bg-red-900/30 border border-red-500 text-red-400 text-xs font-bold px-2 py-1 rounded inline-block">
                       ⛔ ASSIGNED TO: {assignmentText}
                     </div>
                   )}
                   {isMyJob && (
                     <div className="mt-2 bg-blue-900/30 border border-blue-500 text-blue-400 text-xs font-bold px-2 py-1 rounded inline-block">
                       ✅ ASSIGNED TO YOU
                     </div>
                   )}
                 </div>
              </div>

              {/* ACTION BLOCKS (Only visible if it's my job) */}
              {isMyJob ? (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/30">
                  {blocks.map((block, index) => (
                    <div key={index} className={`p-4 rounded-xl border-2 ${block.status === 'DONE' ? 'border-green-500 bg-green-900/10' : 'border-slate-600 bg-slate-800'}`}>
                       <div className="flex justify-between items-center mb-3">
                          <h3 className="font-black text-slate-300 uppercase">{block.name}</h3>
                          {block.status === 'DONE' ? <span className="bg-green-500 text-black text-[10px] font-bold px-2 py-1 rounded">DONE</span> : <span className="bg-orange-600 text-[10px] font-bold px-2 py-1 rounded">PENDING</span>}
                       </div>
                       
                       <ul className="space-y-1 mb-4">
                          {block.steps?.length > 0 ? block.steps.map((step, i) => (
                            <li key={i} className="text-xs text-slate-300 bg-slate-900 p-2 rounded border border-slate-700">• {step}</li>
                          )) : <li className="text-xs text-slate-500 italic">No specific steps.</li>}
                       </ul>

                       {block.status !== 'DONE' && (
                         <button onClick={() => markBlockDone(job, index)} className="w-full bg-blue-600 py-2 rounded font-bold text-sm shadow-lg hover:bg-blue-500 active:scale-95 transition-all">MARK DONE</button>
                       )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-600 text-sm italic">
                   You cannot access this job card.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}