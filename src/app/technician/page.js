"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // For redirection
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // New Auth Tools
import { db, auth } from '../../firebase';

export default function TechnicianDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state
  const [jobs, setJobs] = useState([]);
  
  // 🗺️ IDENTITY MAPPING (Links Email -> Job Card Name)
  const EMAIL_TO_NAME = {
    'raju@workshop.com': 'Raju Mechanic',
    'john@workshop.com': 'John Doe',
    'admin@workshop.com': 'SUPER_ADMIN' // Admin sees everything
  };

  // 1. CHECK FIREBASE AUTH (The New Guard)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/'); // Kick back to login if not signed in
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. FETCH JOBS
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc")); 
    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // 3. LOGOUT HANDLER
  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  // 🛡️ DATA ADAPTER
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

  // --- LOADING SCREEN ---
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-500 font-bold">Authenticating...</div>;

  // --- CALCULATE IDENTITY ---
  // If email is 'raju@workshop.com', this becomes 'Raju Mechanic'
  const myTechnicianName = EMAIL_TO_NAME[user?.email] || 'Unknown User';
  const isAdmin = user?.email.includes('admin');

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans pb-20">
      
      {/* HEADER */}
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div>
           <h1 className="text-lg font-bold text-slate-400">Operator: <span className="text-blue-500">{myTechnicianName}</span></h1>
           <p className="text-[10px] text-slate-500">{user?.email}</p>
        </div>
        <div className="flex gap-3">
           {/* If Admin, show a link to Supervisor Panel */}
           {isAdmin && <Link href="/supervisor" className="bg-slate-800 px-3 py-1 rounded text-green-400 text-xs font-bold border border-green-600">Admin Panel</Link>}
           <button onClick={handleLogout} className="bg-slate-800 px-3 py-1 rounded text-red-400 text-xs font-bold border border-slate-600 hover:bg-slate-700">Logout</button>
        </div>
      </div>

      {/* JOBS LIST */}
      <div className="max-w-4xl mx-auto space-y-6">
        {jobs.length === 0 && <div className="text-center text-slate-500 py-10">No jobs found in database.</div>}

        {jobs.map((job) => {
          const blocks = getSafeBlocks(job);
          
          // 🔎 INTELLIGENT FILTER
          // Is this job assigned to "Raju Mechanic"? Does my email map to "Raju Mechanic"?
          const isMyJob = job.technicianName === myTechnicianName || isAdmin;
          
          return (
            <div key={job.id} className={`bg-slate-800 rounded-2xl border-2 overflow-hidden shadow-xl ${isMyJob ? 'border-blue-500' : 'border-slate-700 opacity-60'}`}>
              
              <div className="p-6 border-b border-slate-700 bg-slate-800 flex justify-between items-start">
                 <div>
                   <h2 className="text-2xl font-black font-mono text-white">{job.regNo || job.vehicleNumber}</h2>
                   <p className="text-slate-400 text-sm">{job.model} • {job.serviceType}</p>
                   
                   {/* IDENTITY BADGE */}
                   <div className={`mt-2 text-xs font-bold px-2 py-1 rounded inline-block ${isMyJob ? 'bg-blue-900/30 text-blue-400 border border-blue-500' : 'bg-slate-900 text-slate-500 border border-slate-700'}`}>
                      {isMyJob ? "✅ ASSIGNED TO YOU" : `⛔ Assigned to: ${job.technicianName || 'Unassigned'}`}
                   </div>
                 </div>
              </div>

              {/* ACTION BLOCKS (Only visible if it's YOUR job or you are ADMIN) */}
              {isMyJob ? (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/30">
                  {blocks.map((block, index) => (
                    <div key={index} className={`p-4 rounded-xl border-2 ${block.status === 'DONE' ? 'border-green-500 bg-green-900/10' : 'border-slate-600 bg-slate-800'}`}>
                       <div className="flex justify-between items-center mb-3">
                          <h3 className="font-black text-slate-300 uppercase tracking-wider">{block.name}</h3>
                          {block.status === 'DONE' ? <span className="bg-green-500 text-black text-[10px] font-bold px-2 py-1 rounded">COMPLETED</span> : <span className="bg-orange-600 text-[10px] font-bold px-2 py-1 rounded">PENDING</span>}
                       </div>
                       
                       <ul className="space-y-2 mb-4">
                          {block.steps?.length > 0 ? block.steps.map((step, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-slate-300 bg-slate-900 p-2 rounded border border-slate-700">
                               <div className="w-4 h-4 rounded-full border border-slate-500"></div>
                               {step}
                            </li>
                          )) : <li className="text-xs text-slate-500 italic">No specific steps.</li>}
                       </ul>

                       {block.status !== 'DONE' && (
                         <button onClick={() => markBlockDone(job, index)} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold text-sm shadow-lg active:scale-95 transition-all">
                           MARK BLOCK DONE
                         </button>
                       )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-600 text-sm italic">
                   Job Locked. Log in as {job.technicianName} to access.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}