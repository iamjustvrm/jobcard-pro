"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';

// ⏸️ PAUSE REASONS
const PAUSE_REASONS = [
  "⛔ Waiting for Parts",
  "📞 Waiting Customer Approval",
  "🔧 Equipment / Bay Issue",
  "🍲 Lunch / Tea Break",
  "🛑 Shift End (Day Over)"
];

// 🔮 COMMON ADVISORY ITEMS
const COMMON_ADVISORIES = ["Clutch Plate", "Brake Pads", "Tyres", "Wiper Blades", "Radiator Hose", "Battery", "Suspension Bushes"];

export default function TechnicianPortal() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  // Existing States
  const [isRequesting, setIsRequesting] = useState(false);
  const [partRequestName, setPartRequestName] = useState('');

  // Phase 1 States
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState(PAUSE_REASONS[0]);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Multi-Advisory State
  const [advisoryList, setAdvisoryList] = useState([]); 
  const [currentAdvisory, setCurrentAdvisory] = useState({ item: '', dueIn: '5000 KM' }); 

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

  // 🆕 TAT CALCULATOR (Improved Visibility)
  const getTATStatus = (promisedTime) => {
    if (!promisedTime) return { text: "NO DEADLINE", color: "text-gray-500 border-gray-600", remaining: "--:--" }; 
    
    let due = new Date(promisedTime);
    const now = new Date();
    
    // Handle "17:30" format
    if (isNaN(due.getTime()) && promisedTime.includes(':')) {
       const [h, m] = promisedTime.split(':');
       due = new Date();
       due.setHours(h, m, 0);
    }

    if (isNaN(due.getTime())) return { text: "INVALID TIME", color: "text-gray-500", remaining: "--" };

    const diffMs = due - now;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    const dateStr = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
    const timeStr = due.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    if (diffMs < 0) return { text: "OVERDUE", color: "text-red-500 animate-pulse font-bold border-red-500", remaining: `+${Math.abs(diffHrs)}h ${Math.abs(diffMins)}m Late`, displayTime: `${timeStr}, ${dateStr}` };
    if (diffHrs < 1) return { text: "URGENT", color: "text-yellow-500 font-bold border-yellow-500", remaining: `${diffMins}m Left`, displayTime: `${timeStr}` };
    return { text: "ON TRACK", color: "text-green-500 border-green-500", remaining: `${diffHrs}h ${diffMins}m Left`, displayTime: `${timeStr}, ${dateStr}` };
  };

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

  const handleRequestPart = async () => {
    if(!partRequestName) return;
    const request = { id: Date.now(), name: partRequestName, status: 'PENDING', timestamp: new Date().toISOString() };
    await updateDoc(doc(db, "jobs", selectedJobId), { partRequests: arrayUnion(request), status: 'WAITING_PARTS' });
    setIsRequesting(false);
    setPartRequestName('');
    alert("🔔 Request Sent to Supervisor!");
  };

  // --- PHASE 1 CONTROLS ---

  const handleStartJob = async () => {
    if(confirm("Start working on this vehicle?")) {
      await updateDoc(doc(db, "jobs", selectedJobId), {
        status: 'WORK_IN_PROGRESS',
        startedAt: serverTimestamp(),
        currentTech: user.email
      });
    }
  };

  const initiatePause = () => setShowPauseModal(true);

  const confirmPause = async () => {
    await updateDoc(doc(db, "jobs", selectedJobId), {
      status: 'WORK_PAUSED',
      pauseReason: pauseReason,
      statusLogs: arrayUnion({ status: 'PAUSED', reason: pauseReason, time: new Date().toISOString() })
    });
    setShowPauseModal(false);
  };

  const handleResumeJob = async () => {
    await updateDoc(doc(db, "jobs", selectedJobId), {
      status: 'WORK_IN_PROGRESS',
      statusLogs: arrayUnion({ status: 'RESUMED', time: new Date().toISOString() })
    });
  };

  const initiateFinish = () => {
    if (activeJob.partRequests?.some(r => r.status === 'PENDING')) {
       alert("⛔ CANNOT FINISH: You have pending part requests! Ask Supervisor to clear them.");
       return;
    }
    if (!isWorkComplete) { alert("⚠️ Cannot Finish: Please complete all checklists first!"); return; }
    
    setAdvisoryList([]);
    setCurrentAdvisory({ item: '', dueIn: '5000 KM' }); 
    setShowFinishModal(true);
  };

  const addAdvisoryItem = () => {
    if(!currentAdvisory.item) return;
    setAdvisoryList([...advisoryList, { ...currentAdvisory, id: Date.now() }]);
    setCurrentAdvisory({ item: '', dueIn: '5000 KM' }); 
  };

  const removeAdvisoryItem = (id) => {
    setAdvisoryList(advisoryList.filter(item => item.id !== id));
  };

  const confirmFinish = async () => {
    const payload = {
      status: 'READY',
      completedAt: serverTimestamp(),
      futureAdvisory: advisoryList 
    };
    await updateDoc(doc(db, "jobs", selectedJobId), payload);
    setShowFinishModal(false);
    setSelectedJobId(null); 
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  // 🎨 COLORS
  const getStatusColor = (status) => {
    if (status === 'WORK_IN_PROGRESS') return 'border-l-orange-500 bg-orange-900/10';
    if (status === 'WORK_PAUSED') return 'border-l-red-500 bg-red-900/10';
    if (status === 'READY') return 'border-l-green-500 bg-green-900/10';
    if (status === 'WAITING_PARTS') return 'border-l-yellow-500 bg-yellow-900/10';
    return 'border-l-gray-500 bg-gray-900'; 
  };

  const getBadgeColor = (status) => {
    if (status === 'WORK_IN_PROGRESS') return 'bg-orange-500 text-black animate-pulse border-orange-600';
    if (status === 'WORK_PAUSED') return 'bg-red-600 text-white border-red-500';
    if (status === 'READY') return 'bg-green-600 text-white border-green-500';
    if (status === 'WAITING_PARTS') return 'bg-yellow-500 text-black border-yellow-600';
    return 'bg-gray-700 text-gray-300 border-gray-600';
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-mono animate-pulse">BOOTING TECH OS...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-mono pb-20">
      
      {/* HEADER */}
      <div className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center sticky top-0 z-50">
        <div><h1 className="text-xl font-bold text-green-500">TECH<span className="text-white">PORTAL</span></h1><p className="text-[10px] text-gray-500">{user?.email}</p></div>
        <button onClick={handleLogout} className="text-xs bg-red-900/30 text-red-500 px-3 py-1 rounded border border-red-900">LOGOUT</button>
      </div>

      <div className="max-w-md mx-auto p-4">
        
        {/* LIST VIEW */}
        {!activeJob && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Assigned Vehicles ({jobs.length})</h2>
            {jobs.map(job => (
              <div key={job.id} onClick={() => setSelectedJobId(job.id)} className={`p-4 rounded-xl border-l-4 active:bg-gray-800 transition-all ${getStatusColor(job.status)}`}>
                 <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-black text-white">{job.regNo}</h3>
                        <p className="text-sm text-gray-400">
                            {job.model} 
                            {job.color && <span className="ml-2 text-[10px] bg-gray-700 px-2 py-0.5 rounded text-white border border-gray-600">{job.color}</span>}
                        </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-1 rounded border font-bold uppercase ${getBadgeColor(job.status)}`}>
                        {job.status === 'ESTIMATE' ? 'ASSIGNED' : job.status.replace(/_/g, " ")}
                      </span>
                    </div>
                 </div>
              </div>
            ))}
            {jobs.length === 0 && <div className="text-center text-gray-600 mt-10">No vehicles on the floor.</div>}
          </div>
        )}

        {/* ACTIVE JOB VIEW */}
        {activeJob && (
          <div className="animate-in slide-in-from-right duration-300 relative">
             <button onClick={() => setSelectedJobId(null)} className="mb-4 text-xs font-bold text-gray-500 flex items-center gap-2">⬅ BACK TO FLOOR</button>
             
             {/* SMART CONTROL PANEL */}
             <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6">
                
                {/* ROW 1: Reg No & Status */}
                <div className="flex justify-between items-start mb-2">
                  <h1 className="text-3xl font-black text-white">{activeJob.regNo}</h1>
                  <div className={`text-xs px-2 py-1 rounded border font-bold uppercase ${getBadgeColor(activeJob.status)}`}>
                       {activeJob.status.replace(/_/g, " ")}
                  </div>
                </div>

                {/* ROW 2: Model & Odo */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
                    <div className="flex flex-col gap-1">
                        <div className="flex gap-2 items-center text-sm text-gray-300">
                           <span>{activeJob.model}</span>
                           {activeJob.color && <span className="text-xs bg-gray-700 px-2 py-0.5 rounded border border-gray-600">{activeJob.color}</span>}
                        </div>
                    </div>
                    {/* ✅ ODOMETER RESTORED */}
                    <div className="text-sm font-mono text-gray-400 bg-black px-2 py-1 rounded border border-gray-600">{activeJob.odometer || 0} KM</div>
                </div>

                {/* ROW 3: TAT CLOCK (ALWAYS VISIBLE) */}
                {(() => {
                     const tat = getTATStatus(activeJob.promisedDelivery);
                     return (
                         <div className={`bg-gray-900 rounded p-2 mb-4 flex justify-between items-center text-xs border border-dashed ${tat.color}`}>
                            <span className="flex items-center gap-2">⏰ DUE: <span className="text-white">{activeJob.promisedDelivery || 'Not Set'}</span></span>
                            <span className="font-bold bg-gray-800 px-2 py-1 rounded text-[10px]">{tat.remaining}</span>
                         </div>
                     )
                })()}

                {/* ✅ CONTROLS (START/PAUSE/RESUME/FINISH) */}
                <div className="grid grid-cols-2 gap-3">
                   {(activeJob.status === 'ESTIMATE' || activeJob.status === 'ASSIGNED') && (
                     <button onClick={handleStartJob} className="col-span-2 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg text-lg">▶ START WORK</button>
                   )}
                   {activeJob.status === 'WORK_IN_PROGRESS' && (
                     <>
                       <button onClick={initiatePause} className="bg-red-900/50 border border-red-600 text-red-400 hover:bg-red-900 font-bold py-3 rounded-xl">⏸ PAUSE</button>
                       <button onClick={initiateFinish} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl">✅ FINISH</button>
                     </>
                   )}
                   {activeJob.status === 'WORK_PAUSED' && (
                     <div className="col-span-2">
                       <p className="text-xs text-red-400 text-center mb-2">paused: {activeJob.pauseReason}</p>
                       <button onClick={handleResumeJob} className="w-full bg-orange-500 hover:bg-orange-400 text-black font-bold py-4 rounded-xl shadow-lg text-lg">▶ RESUME WORK</button>
                     </div>
                   )}
                   {activeJob.status === 'READY' && (
                     <div className="col-span-2 bg-green-900/30 border border-green-500 p-3 rounded-xl text-center text-green-400 font-bold">VEHICLE READY FOR QC</div>
                   )}
                </div>
             </div>

             {/* PAUSE MODAL */}
             {showPauseModal && (
               <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                 <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm border border-gray-700">
                   <h3 className="text-xl font-bold text-white mb-4">Why are you pausing?</h3>
                   <div className="space-y-2 mb-6">
                     {PAUSE_REASONS.map(reason => (
                       <button key={reason} onClick={() => setPauseReason(reason)} className={`w-full text-left p-3 rounded-lg border ${pauseReason === reason ? 'bg-red-600 border-red-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>{reason}</button>
                     ))}
                   </div>
                   <div className="flex gap-3">
                     <button onClick={() => setShowPauseModal(false)} className="flex-1 bg-gray-700 py-3 rounded-xl font-bold text-gray-300">CANCEL</button>
                     <button onClick={confirmPause} className="flex-1 bg-red-600 py-3 rounded-xl font-bold text-white">CONFIRM PAUSE</button>
                   </div>
                 </div>
               </div>
             )}

             {/* MULTI-ADVISORY MODAL */}
             {showFinishModal && (
               <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                 <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm border border-gray-700">
                   <h3 className="text-xl font-bold text-green-400 mb-2">Future Work Report</h3>
                   <p className="text-xs text-gray-400 mb-4">Add any issues found (Wiper, Clutch, etc.) for future follow-up.</p>
                   
                   {/* ADD FORM */}
                   <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 mb-4">
                      <div className="mb-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Issue Found</label>
                        <input list="common-issues" className="w-full bg-black border border-gray-600 rounded p-2 text-white text-sm" placeholder="Type or Select..." value={currentAdvisory.item} onChange={e => setCurrentAdvisory({...currentAdvisory, item: e.target.value})} />
                        <datalist id="common-issues">{COMMON_ADVISORIES.map(i => <option key={i} value={i} />)}</datalist>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-grow">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Due In</label>
                          <select className="w-full bg-black border border-gray-600 rounded p-2 text-white text-sm" value={currentAdvisory.dueIn} onChange={e => setCurrentAdvisory({...currentAdvisory, dueIn: e.target.value})}>
                            <option>Urgent / Immediate</option>
                            <option>2000 KM</option>
                            <option>5000 KM</option>
                            <option>10000 KM (Next Service)</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                           <button onClick={addAdvisoryItem} disabled={!currentAdvisory.item} className="bg-blue-600 disabled:bg-gray-700 px-4 py-2 rounded font-bold text-sm h-[38px]">+</button>
                        </div>
                      </div>
                   </div>

                   {/* ADDED LIST */}
                   <div className="space-y-2 mb-6 max-h-[150px] overflow-y-auto">
                      {advisoryList.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-black p-2 rounded border border-gray-700">
                           <span className="text-sm text-white">{item.item} <span className="text-gray-500 text-xs">({item.dueIn})</span></span>
                           <button onClick={() => removeAdvisoryItem(item.id)} className="text-red-500 font-bold px-2">×</button>
                        </div>
                      ))}
                      {advisoryList.length === 0 && <div className="text-center text-xs text-gray-600 py-2">No future work added.</div>}
                   </div>

                   <div className="flex gap-3">
                     <button onClick={() => setShowFinishModal(false)} className="flex-1 bg-gray-700 py-3 rounded-xl font-bold text-gray-300">BACK</button>
                     <button onClick={confirmFinish} className="flex-1 bg-green-600 py-3 rounded-xl font-bold text-white">COMPLETE JOB</button>
                   </div>
                 </div>
               </div>
             )}

             {/* REQUESTS */}
             <div className="mb-6 border border-dashed border-gray-600 rounded-xl p-4 bg-gray-900/50">
                <h3 className="text-xs font-bold text-orange-400 uppercase mb-2 flex justify-between items-center">
                  <span>🔔 Extra Parts Requests</span>
                  <button onClick={() => setIsRequesting(!isRequesting)} className="text-[10px] bg-orange-600 text-black px-2 py-1 rounded font-bold hover:bg-orange-500">+ REQUEST</button>
                </h3>
                {isRequesting && (
                  <div className="mb-4 flex gap-2">
                    <input autoFocus placeholder="Part Name..." className="bg-black border border-gray-600 rounded text-sm p-2 flex-grow text-white" value={partRequestName} onChange={e => setPartRequestName(e.target.value)} />
                    <button onClick={handleRequestPart} className="bg-green-600 px-3 rounded text-xs font-bold">SEND</button>
                  </div>
                )}
                <div className="space-y-2">
                  {activeJob.partRequests?.map((req, i) => (
                    <div key={i} className="flex justify-between items-center bg-black p-2 rounded border border-gray-800">
                       <span className="text-sm">{req.name}</span>
                       <span className={`text-[10px] px-2 py-1 rounded font-bold ${req.status === 'APPROVED' ? 'bg-green-500 text-black' : 'bg-orange-500/20 text-orange-500'}`}>{req.status === 'APPROVED' ? '🟢 READY' : '⏳ WAITING'}</span>
                    </div>
                  ))}
                  {/* Empty State Text */}
                  {(!activeJob.partRequests || activeJob.partRequests.length === 0) && <div className="text-[10px] text-gray-600 italic">No extra requests yet.</div>}
                </div>
             </div>

             {/* ✅ RESTORED: APPROVED PARTS SECTION */}
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
          </div>
        )}
      </div>
    </div>
  );
}