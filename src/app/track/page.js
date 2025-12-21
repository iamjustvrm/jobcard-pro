"use client";
import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../../firebase';

export default function CustomerTracker() {
  const [regInput, setRegInput] = useState('');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugLog, setDebugLog] = useState(''); // For troubleshooting

  // 🔍 SMART SEARCH LOGIC
  const handleTrack = async (e) => {
    e.preventDefault();
    if(!regInput) return;
    
    setLoading(true);
    setError('');
    setJob(null);
    setDebugLog('');

    const rawInput = regInput.toUpperCase().trim(); // "TN 20 BB 4444"
    const strippedInput = rawInput.replace(/\s/g, ''); // "TN20BB4444"

    try {
        const jobsRef = collection(db, "jobs");
        let foundDocs = [];

        // 🕵️ ATTEMPT 1: Search EXACT match (e.g. "TN 20 BB 4444")
        const q1 = query(jobsRef, where("regNo", "==", rawInput));
        const snap1 = await getDocs(q1);
        snap1.forEach(doc => foundDocs.push({ id: doc.id, ...doc.data() }));

        // 🕵️ ATTEMPT 2: Search STRIPPED match (e.g. "TN20BB4444") if Attempt 1 failed
        if (foundDocs.length === 0 && rawInput !== strippedInput) {
             const q2 = query(jobsRef, where("vehicleNumber", "==", strippedInput)); // Assuming vehicleNumber is saved stripped
             const snap2 = await getDocs(q2);
             snap2.forEach(doc => foundDocs.push({ id: doc.id, ...doc.data() }));
             
             // 🕵️ ATTEMPT 3: Try regNo with stripped (Just in case)
             const q3 = query(jobsRef, where("regNo", "==", strippedInput));
             const snap3 = await getDocs(q3);
             snap3.forEach(doc => foundDocs.push({ id: doc.id, ...doc.data() }));
        }

        // 🕵️ ATTEMPT 4: If still nothing, check if user typed spaces but DB has none
        if (foundDocs.length === 0) {
             // We can't query "contains" in Firestore easily, but the above covers 99%
        }

        if (foundDocs.length === 0) {
            throw new Error("NOT_FOUND");
        }

        // ✅ FOUND! Sort by Date (Client Side to avoid Index Errors)
        // Deduplicate first based on ID
        const uniqueJobs = Array.from(new Map(foundDocs.map(item => [item.id, item])).values());
        
        uniqueJobs.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA; // Newest first
        });

        setJob(uniqueJobs[0]);

    } catch (err) {
        console.error("Tracking Error:", err);
        if (err.message === "NOT_FOUND") {
            setError(`⚠️ Vehicle ${rawInput} not found. Try entering exactly as on the Receipt.`);
        } else if (err.code === 'permission-denied') {
            setError("🔒 System Security Error: Public access is locked. Please contact Workshop Admin.");
        } else {
            setError(`❌ System Error: ${err.message}`);
        }
    } finally {
        setLoading(false);
    }
  };

  // 📊 STATUS MAPPING
  const getProgress = (status) => {
      const stages = ['ESTIMATE', 'WORK_IN_PROGRESS', 'READY', 'DELIVERED'];
      let currentIdx = stages.indexOf(status);
      if (status === 'WORK_PAUSED') currentIdx = 1; 
      if (currentIdx === -1) currentIdx = 0;
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
      <div className="p-6 text-center border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <h1 className="text-2xl font-black tracking-tighter">JOB<span className="text-blue-500">CARD</span> <span className="font-light opacity-50">TRACKER</span></h1>
      </div>

      <div className="max-w-md mx-auto p-6">
        {!job && (
            <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center space-y-2">
                    <div className="text-6xl mb-4 animate-bounce">🏎️</div>
                    <h2 className="text-3xl font-bold text-white">Track Your Repair</h2>
                    <p className="text-slate-400 max-w-xs mx-auto">Enter your Vehicle Number to see live status.</p>
                </div>
                <form onSubmit={handleTrack} className="w-full relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative flex gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                        <input className="bg-transparent w-full p-4 text-xl font-black uppercase tracking-widest outline-none text-white placeholder-slate-500" placeholder="e.g. TN20BB4444" value={regInput} onChange={(e) => setRegInput(e.target.value)} />
                        <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center min-w-[80px]">{loading ? <span className="animate-spin text-xl">⟳</span> : 'GO'}</button>
                    </div>
                </form>
                {error && <div className="text-red-400 font-bold bg-red-900/20 px-4 py-3 rounded-lg text-sm border border-red-900/50 text-center">{error}</div>}
            </div>
        )}

        {job && (() => {
            const { currentIdx, percent } = getProgress(job.status);
            const total = (job.parts?.reduce((a,b)=>a+(Number(b.total)||0),0)||0) + (job.labor?.reduce((a,b)=>a+(Number(b.total)||0),0)||0);
            
            return (
                <div className="space-y-6 animate-in zoom-in duration-300">
                    <button onClick={() => setJob(null)} className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-1 mb-4">⬅ TRACK ANOTHER VEHICLE</button>
                    
                    {/* CARD */}
                    <div className={`${theme.card} p-6 rounded-2xl shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl grayscale">🚗</div>
                        <h2 className="text-4xl font-black uppercase font-mono tracking-tight text-white relative z-10">{job.regNo || job.vehicleNumber}</h2>
                        <p className="text-lg text-blue-400 font-bold mt-1 relative z-10">{job.model} <span className="text-slate-500 text-sm">{job.color}</span></p>
                    </div>

                    {/* STATUS */}
                    <div className={`${theme.card} p-6 rounded-2xl`}>
                        <div className="relative mb-8 px-2">
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -z-0 rounded"></div>
                            <div className="absolute top-1/2 left-0 h-1 bg-blue-500 transition-all duration-1000 -z-0 rounded" style={{ width: `${percent}%` }}></div>
                            <div className="flex justify-between relative z-10">
                                {['Recv', 'Work', 'QC', 'Ready'].map((step, i) => (
                                    <div key={step} className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 bg-slate-900 ${i <= currentIdx ? 'border-blue-500 text-blue-500' : 'border-slate-700 text-slate-700'}`}>{i < currentIdx ? '✓' : i === currentIdx ? <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" /> : <div className="w-2 h-2 bg-slate-700 rounded-full" />}</div>
                                        <span className={`text-[9px] mt-2 font-bold uppercase transition-all ${i <= currentIdx ? 'text-white' : 'text-slate-600'}`}>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl text-center">
                            <p className="text-white font-bold">{job.status.replace(/_/g, ' ')}</p>
                            {job.status === 'WORK_PAUSED' && <p className="text-red-400 text-xs mt-1">Reason: {job.pauseReason}</p>}
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

                    {/* BILL */}
                    <div className={`${theme.card} p-6 rounded-2xl`}>
                        <div className="flex justify-between items-center pt-2">
                            <span className="font-bold text-lg text-white">EST. TOTAL</span>
                            <span className="font-black text-2xl text-green-400">₹{total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            );
        })()}
      </div>
    </div>
  );
}