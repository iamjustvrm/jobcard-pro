"use client";
import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../../firebase';

export default function CustomerTracker() {
  const [regInput, setRegInput] = useState('');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 🔍 ROBUST SEARCH LOGIC (Fixes "Not Found" & Indexing Errors)
  const handleTrack = async (e) => {
    e.preventDefault();
    if(!regInput) return;
    
    // 1. Clean Input (Remove spaces, make Uppercase)
    const cleanReg = regInput.toUpperCase().replace(/\s/g, '');
    
    setLoading(true);
    setError('');
    setJob(null);

    try {
        // 2. Fetch ALL jobs for this car (No OrderBy to avoid Index Error)
        const jobsRef = collection(db, "jobs");
        
        // Try searching by 'vehicleNumber'
        let q = query(jobsRef, where("vehicleNumber", "==", cleanReg));
        let snap = await getDocs(q);

        // If empty, try searching by 'regNo' (Legacy field)
        if (snap.empty) {
            q = query(jobsRef, where("regNo", "==", cleanReg));
            snap = await getDocs(q);
        }

        if (snap.empty) {
            throw new Error("Vehicle not found.");
        }

        // 3. Client-Side Sorting (Find the Newest Job)
        // We do this here to avoid Firebase "Composite Index" requirements
        const allJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Sort by CreatedAt (Newest First)
        allJobs.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        // 4. Set the Latest Job
        setJob(allJobs[0]);

    } catch (err) {
        console.error(err);
        setError(`⚠️ No active job found for ${cleanReg}. Please check the number.`);
    } finally {
        setLoading(false);
    }
  };

  // 📊 STATUS VISUALS
  const getProgress = (status) => {
      // Normalize status to match standard flow
      const stages = ['ESTIMATE', 'WORK_IN_PROGRESS', 'READY', 'DELIVERED'];
      let currentIdx = stages.indexOf(status);
      
      // Handle edge cases
      if (status === 'WORK_PAUSED') currentIdx = 1; // Treat as Work Phase
      if (currentIdx === -1) currentIdx = 0; // Default to start

      return { currentIdx, percent: (currentIdx / (stages.length - 1)) * 100 };
  };

  const theme = {
      bg: "bg-slate-900",
      card: "bg-slate-800 border border-slate-700",
      textMain: "text-white",
      textSub: "text-slate-400"
  };

  return (
    <div className={`min-h-screen ${theme.bg} text-white font-sans selection:bg-blue-500 selection:text-white`}>
      
      {/* HEADER */}
      <div className="p-6 text-center border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <h1 className="text-2xl font-black tracking-tighter">JOB<span className="text-blue-500">CARD</span> <span className="font-light opacity-50">TRACKER</span></h1>
      </div>

      <div className="max-w-md mx-auto p-6">
        
        {/* 1. SEARCH INPUT */}
        {!job && (
            <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center space-y-2">
                    <div className="text-6xl mb-4 animate-bounce">🏎️</div>
                    <h2 className="text-3xl font-bold text-white">Track Your Repair</h2>
                    <p className="text-slate-400 max-w-xs mx-auto">Enter your Vehicle Registration Number to see live workshop status.</p>
                </div>
                
                <form onSubmit={handleTrack} className="w-full relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative flex gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                        <input 
                            className="bg-transparent w-full p-4 text-xl font-black uppercase tracking-widest placeholder:normal-case placeholder:font-normal placeholder:tracking-normal outline-none text-white placeholder-slate-500"
                            placeholder="e.g. KA05MB1234"
                            value={regInput}
                            onChange={(e) => setRegInput(e.target.value)}
                        />
                        <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center min-w-[80px]">
                            {loading ? <span className="animate-spin text-xl">⟳</span> : 'GO'}
                        </button>
                    </div>
                </form>
                {error && <p className="text-red-400 font-bold bg-red-900/20 px-4 py-3 rounded-lg text-sm border border-red-900/50">{error}</p>}
            </div>
        )}

        {/* 2. LIVE STATUS DASHBOARD */}
        {job && (() => {
            const { currentIdx, percent } = getProgress(job.status);
            const total = (job.parts?.reduce((a,b)=>a+(Number(b.total)||0),0)||0) + (job.labor?.reduce((a,b)=>a+(Number(b.total)||0),0)||0);
            
            return (
                <div className="space-y-6 animate-in zoom-in duration-300">
                    
                    {/* NAV BACK */}
                    <button onClick={() => setJob(null)} className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-1 mb-4">
                        ⬅ TRACK ANOTHER VEHICLE
                    </button>

                    {/* VEHICLE CARD */}
                    <div className={`${theme.card} p-6 rounded-2xl shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl grayscale">🚗</div>
                        <h2 className="text-4xl font-black uppercase font-mono tracking-tight text-white relative z-10">{job.regNo || job.vehicleNumber}</h2>
                        <p className="text-lg text-blue-400 font-bold mt-1 relative z-10">{job.model} <span className="text-slate-500 text-sm">{job.color}</span></p>
                        <div className="flex flex-wrap gap-2 mt-4 text-[10px] font-mono font-bold text-slate-400 relative z-10">
                            <span className="bg-black/40 px-2 py-1 rounded border border-white/10">📅 {new Date(job.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                            <span className="bg-black/40 px-2 py-1 rounded border border-white/10">📂 {job.id.slice(-6)}</span>
                        </div>
                    </div>

                    {/* TRACKER BAR */}
                    <div className={`${theme.card} p-6 rounded-2xl`}>
                        <h3 className="text-xs font-bold uppercase text-slate-500 mb-6 tracking-widest">Live Status</h3>
                        
                        {/* PROGRESS VISUAL */}
                        <div className="relative mb-8 px-2">
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -z-0 rounded"></div>
                            <div className="absolute top-1/2 left-0 h-1 bg-blue-500 transition-all duration-1000 -z-0 rounded" style={{ width: `${percent}%` }}></div>
                            
                            <div className="flex justify-between relative z-10">
                                {['Received', 'Repairing', 'QC Check', 'Ready'].map((step, i) => (
                                    <div key={step} className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 bg-slate-900 ${i <= currentIdx ? 'border-blue-500 text-blue-500' : 'border-slate-700 text-slate-700'}`}>
                                            {i < currentIdx ? '✓' : i === currentIdx ? <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" /> : <div className="w-2 h-2 bg-slate-700 rounded-full" />}
                                        </div>
                                        <span className={`text-[9px] mt-2 font-bold uppercase transition-all ${i <= currentIdx ? 'text-white' : 'text-slate-600'}`}>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* STATUS MESSAGE */}
                        <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl text-center">
                            {job.status === 'ESTIMATE' && <p className="text-yellow-400 text-sm font-bold">Estimate Created. Pending Approval.</p>}
                            {job.status === 'WORK_IN_PROGRESS' && <p className="text-blue-400 text-sm font-bold animate-pulse">🔧 Technician is currently working.</p>}
                            {job.status === 'WORK_PAUSED' && <p className="text-red-400 text-sm font-bold">⚠️ Paused: {job.pauseReason || 'Parts pending'}</p>}
                            {job.status === 'READY' && <p className="text-green-400 text-sm font-bold">✅ Ready for Delivery! Visit us.</p>}
                            {job.status === 'DELIVERED' && <p className="text-slate-400 text-sm font-bold">Vehicle Delivered. Drive Safe! 👋</p>}
                        </div>
                    </div>

                    {/* PHOTOS */}
                    {(job.inspectionPhotos?.length > 0) && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold uppercase text-slate-500 ml-1">Inspection Photos</h3>
                            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                                {job.inspectionPhotos.map((img, i) => (
                                    <img key={i} src={img} className="h-32 w-auto rounded-xl border border-slate-700 shadow-lg object-cover" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* BILL PREVIEW */}
                    <div className={`${theme.card} p-6 rounded-2xl`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold uppercase text-slate-500">Bill Summary</h3>
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded">ESTIMATE</span>
                        </div>
                        
                        <div className="space-y-2 mb-4 text-sm">
                            {job.parts?.length > 0 && <div className="flex justify-between text-slate-400"><span>Parts ({job.parts.length})</span><span>₹{job.parts.reduce((a,b)=>a+b.total,0)}</span></div>}
                            {job.labor?.length > 0 && <div className="flex justify-between text-slate-400"><span>Labor Charges</span><span>₹{job.labor.reduce((a,b)=>a+b.total,0)}</span></div>}
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                            <span className="font-bold text-lg text-white">TOTAL</span>
                            <span className="font-black text-2xl text-green-400">₹{total.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* CONTACT */}
                    <button onClick={() => window.location.reload()} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-bold text-slate-400 text-sm">
                        🔄 Refresh Status
                    </button>

                </div>
            );
        })()}

      </div>
    </div>
  );
}