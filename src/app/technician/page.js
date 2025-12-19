"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'; // Added arrayUnion
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';

export default function TechnicianPortal() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  // NEW: Request Part State
  const [isRequesting, setIsRequesting] = useState(false);
  const [partRequestName, setPartRequestName] = useState('');

  // 1. SECURITY
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push('/');
      else { setUser(currentUser); setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. LIVE FEED
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const activeJobs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(j => j.status !== 'DELIVERED'); 
      setJobs(activeJobs);
    });
    return () => unsub();
  }, []);

  const activeJob = jobs.find(j => j.id === selectedJobId);

  // 🚦 SAFETY INTERLOCK
  const getCompletionStatus = () => {
    if (!activeJob) return false;
    const allSteps = activeJob.blocks.flatMap(b => b.steps);
    if (allSteps.length === 0) return true;
    return allSteps.every(step => step.includes("✅"));
  };
  const isWorkComplete = getCompletionStatus();

  // 3. HANDLERS
  const toggleTask = async (jobId, blockIndex, taskIndex) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const newBlocks = [...job.blocks];
    const task = newBlocks[blockIndex].steps[taskIndex];
    if (task.includes("✅")) newBlocks[blockIndex].steps[taskIndex] = task.replace(" ✅", "");
    else newBlocks[blockIndex].steps[taskIndex] = task + " ✅";
    await updateDoc(doc(db, "jobs", jobId), { blocks: newBlocks });
  };

  const markJobDone = async (jobId) => {
    // BLOCK IF PENDING PARTS
    if (activeJob.partRequests?.some(r => r.status === 'PENDING')) {
       alert("⛔ CANNOT FINISH: You have pending part requests! Ask Supervisor to clear them.");
       return;
    }
    if (!isWorkComplete) { alert("⚠️ Cannot Finish: Please complete all checklists first!"); return; }
    if(confirm("Mark vehicle READY?")) {
      await updateDoc(doc(db, "jobs", jobId), { status: 'READY', completedAt: serverTimestamp() });
      setSelectedJobId(null); 
    }
  };

  // 🆕 PART REQUEST HANDLER
  const handleRequestPart = async () => {
    if(!partRequestName) return;
    const request = {
      id: Date.now(),
      name: partRequestName,
      status: 'PENDING', // PENDING | APPROVED
      timestamp: new Date().toISOString()
    };
    await updateDoc(doc(db, "jobs", selectedJobId), {
      partRequests: arrayUnion(request),
      status: 'WAITING_PARTS' // Updates status for Supervisor
    });
    setIsRequesting(false);
    setPartRequestName('');
    alert("🔔 Request Sent to Supervisor!");
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-mono animate-pulse">BOOTING TECH OS...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-mono pb-20">
      <div className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center sticky top-0 z-50">
        <div><h1 className="text-xl font-bold text-green-500">TECH<span className="text-white">PORTAL</span></h1><p className="text-[10px] text-gray-500">{user?.email}</p></div>
        <button onClick={handleLogout} className="text-xs bg-red-900/30 text-red-500 px-3 py-1 rounded border border-red-900">LOGOUT</button>
      </div>

      <div className="max-w-md mx-auto p-4">
        {!activeJob && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Assigned Vehicles ({jobs.length})</h2>
            {jobs.map(job => (
              <div key={job.id} onClick={() => setSelectedJobId(job.id)} className={`p-4 rounded-xl border-l-4 active:bg-gray-800 transition-all ${job.status === 'WAITING_PARTS' ? 'bg-orange-900/20 border-l-orange-500' : 'bg-gray-900 border-l-blue-500'}`}>
                 <div className="flex justify-between items-start">
                    <div><h3 className="text-2xl font-black text-white">{job.regNo}</h3><p className="text-sm text-gray-400">{job.model}</p></div>
                    <div className="text-right"><span className={`text-[10px] px-2 py-1 rounded font-bold ${job.status === 'WAITING_PARTS' ? 'bg-orange-500 text-black animate-pulse' : 'bg-yellow-500 text-black'}`}>{job.status}</span></div>
                 </div>
              </div>
            ))}
          </div>
        )}

        {activeJob && (
          <div className="animate-in slide-in-from-right duration-300">
             <button onClick={() => setSelectedJobId(null)} className="mb-4 text-xs font-bold text-gray-500 flex items-center gap-2">⬅ BACK TO FLOOR</button>
             
             {/* HEADER */}
             <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6">
                <h1 className="text-3xl font-black text-yellow-400">{activeJob.regNo}</h1>
                <div className="flex justify-between mt-2 text-sm text-gray-300"><span>{activeJob.model}</span><span>{activeJob.odometer} KM</span></div>
             </div>

             {/* 🆕 EXTRA PARTS REQUESTS SECTION */}
             <div className="mb-6 border border-dashed border-gray-600 rounded-xl p-4 bg-gray-900/50">
                <h3 className="text-xs font-bold text-orange-400 uppercase mb-2 flex justify-between items-center">
                  <span>🔔 Extra Parts Requests</span>
                  <button onClick={() => setIsRequesting(!isRequesting)} className="text-[10px] bg-orange-600 text-black px-2 py-1 rounded font-bold hover:bg-orange-500">+ REQUEST</button>
                </h3>
                
                {/* REQUEST FORM */}
                {isRequesting && (
                  <div className="mb-4 flex gap-2">
                    <input autoFocus placeholder="Part Name (e.g. Drive Belt)" className="bg-black border border-gray-600 rounded text-sm p-2 flex-grow text-white" value={partRequestName} onChange={e => setPartRequestName(e.target.value)} />
                    <button onClick={handleRequestPart} className="bg-green-600 px-3 rounded text-xs font-bold">SEND</button>
                  </div>
                )}

                {/* REQUEST LIST */}
                <div className="space-y-2">
                  {activeJob.partRequests?.map((req, i) => (
                    <div key={i} className="flex justify-between items-center bg-black p-2 rounded border border-gray-800">
                       <span className="text-sm">{req.name}</span>
                       <span className={`text-[10px] px-2 py-1 rounded font-bold ${req.status === 'APPROVED' ? 'bg-green-500 text-black' : 'bg-orange-500/20 text-orange-500'}`}>
                         {req.status === 'APPROVED' ? '🟢 READY' : '⏳ WAITING'}
                       </span>
                    </div>
                  ))}
                  {(!activeJob.partRequests || activeJob.partRequests.length === 0) && <div className="text-[10px] text-gray-600 italic">No extra requests yet.</div>}
                </div>
             </div>

             {/* EXISTING PARTS LIST */}
             <div className="mb-6">
                <h3 className="text-xs font-bold text-purple-400 uppercase mb-2">📦 Approved Parts (Store)</h3>
                <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                   {activeJob.parts?.length > 0 ? activeJob.parts.map((part, i) => (
                      <div key={i} className="p-3 border-b border-gray-800 flex justify-between items-center"><span className="text-sm font-bold text-white">{part.desc}</span><span className="text-xs bg-purple-900 text-purple-200 px-2 py-1 rounded">Qty: {part.qty}</span></div>
                   )) : <div className="p-4 text-xs text-gray-500 italic">No parts assigned yet.</div>}
                </div>
             </div>

             {/* TASKS */}
             <div className="mb-8 space-y-4">
                {activeJob.blocks.map((block, bIndex) => (
                   <div key={bIndex} className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                      <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase">{block.name}</h4>
                      <div className="space-y-2">{block.steps.map((step, tIndex) => { const isDone = step.includes("✅"); return (<div key={tIndex} onClick={() => toggleTask(activeJob.id, bIndex, tIndex)} className={`cursor-pointer p-3 rounded border transition-all flex items-center gap-3 ${isDone ? 'bg-green-900/20 border-green-500/50 text-green-400' : 'bg-black border-gray-800 text-gray-300'}`}><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isDone ? 'border-green-500 bg-green-500 text-black' : 'border-gray-600'}`}>{isDone && "✓"}</div><span className={isDone ? 'line-through opacity-70' : ''}>{step.replace(" ✅", "")}</span></div>); })}</div>
                   </div>
                ))}
             </div>

             {/* BUTTON */}
             <button onClick={() => markJobDone(activeJob.id)} className={`w-full font-bold py-4 rounded-xl shadow-lg mb-8 transition-all ${isWorkComplete ? 'bg-green-600 hover:bg-green-500 text-white animate-pulse' : 'bg-orange-600 hover:bg-orange-500 text-black opacity-90'}`}>{isWorkComplete ? "✅ MARK VEHICLE READY" : "⏳ TASKS PENDING"}</button>
          </div>
        )}
      </div>
    </div>
  );
}