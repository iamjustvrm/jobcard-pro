"use client";
import { useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'; 
import { db } from '../../firebase';

export default function CustomerTracker() {
  const [regInput, setRegInput] = useState('');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 🔍 SEARCH LOGIC
  const handleTrack = async (e) => {
    e.preventDefault();
    if(!regInput) return;
    setLoading(true);
    setError('');
    setJob(null);

    try {
        // Find the LATEST job for this vehicle
        const q = query(
            collection(db, "jobs"), 
            where("vehicleNumber", "==", regInput.toUpperCase().replace(/\s/g, '')), // Normalize input
            orderBy("createdAt", "desc"),
            limit(1)
        );
        
        const snap = await getDocs(q);
        
        // If not found by vehicleNumber, try regNo (legacy compatibility)
        if (snap.empty) {
             const q2 = query(
                collection(db, "jobs"), 
                where("regNo", "==", regInput.toUpperCase().replace(/\s/g, '')),
                orderBy("createdAt", "desc"),
                limit(1)
            );
            const snap2 = await getDocs(q2);
            if(snap2.empty) throw new Error("Vehicle not found in active records.");
            setJob({ id: snap2.docs[0].id, ...snap2.docs[0].data() });
        } else {
            setJob({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }

    } catch (err) {
        setError("⚠️ Vehicle not found. Please check the Registration Number.");
    } finally {
        setLoading(false);
    }
  };

  // 📊 STATUS MAPPING (Logic to Visuals)
  const getProgress = (status) => {
      const stages = ['ESTIMATE', 'WORK_IN_PROGRESS', 'READY', 'DELIVERED'];
      const currentIdx = stages.indexOf(status) === -1 ? 0 : stages.indexOf(status);
      return { currentIdx, percent: (currentIdx / (stages.length - 1)) * 100 };
  };

  // 🎨 UI THEME
  const theme = {
      bg: "bg-slate-900",
      card: "bg-slate-800 border border-slate-700",
      textMain: "text-white",
      textSub: "text-slate-400",
      accent: "text-blue-400"
  };

  return (
    <div className={`min-h-screen ${theme.bg} text-white font-sans selection:bg-blue-500 selection:text-white`}>
      
      {/* HEADER */}
      <div className="p-6 text-center border-b border-slate-800">
        <h1 className="text-2xl font-black tracking-tighter">JOB<span className="text-blue-500">CARD</span> <span className="font-light opacity-50">LIVE</span></h1>
      </div>

      <div className="max-w-md mx-auto p-6">
        
        {/* 1. SEARCH HERO */}
        {!job && (
            <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center space-y-2">
                    <div className="text-6xl mb-4">🏎️</div>
                    <h2 className="text-3xl font-bold text-white">Track Your Vehicle</h2>
                    <p className="text-slate-400">Enter your registration number to see live status.</p>
                </div>
                
                <form onSubmit={handleTrack} className="w-full relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative flex gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                        <input 
                            className="bg-transparent w-full p-4 text-xl font-black uppercase tracking-widest placeholder:normal-case placeholder:font-normal placeholder:tracking-normal outline-none text-white placeholder-slate-500"
                            placeholder="e.g. KA01AB1234"
                            value={regInput}
                            onChange={(e) => setRegInput(e.target.value)}
                        />
                        <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold transition-all shadow-lg">
                            {loading ? '🔍...' : 'TRACK'}
                        </button>
                    </div>
                </form>
                {error && <p className="text-red-400 font-bold bg-red-900/20 px-4 py-2 rounded-lg animate-pulse">{error}</p>}
            </div>
        )}

        {/* 2. RESULTS DASHBOARD */}
        {job && (() => {
            const { currentIdx, percent } = getProgress(job.status);
            const total = (job.parts?.reduce((a,b)=>a+(Number(b.total)||0),0)||0) + (job.labor?.reduce((a,b)=>a+(Number(b.total)||0),0)||0);
            
            return (
                <div className="space-y-6 animate-in zoom-in duration-500">
                    
                    {/* BACK BUTTON */}
                    <button onClick={() => setJob(null)} className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-1">⬅ TRACK ANOTHER</button>

                    {/* VEHICLE HEADER */}
                    <div className={`${theme.card} p-6 rounded-2xl shadow-2xl relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">🚗</div>
                        <h2 className="text-4xl font-black uppercase font-mono tracking-tight">{job.regNo || job.vehicleNumber}</h2>
                        <p className="text-lg text-blue-400 font-bold mt-1">{job.model} {job.variant}</p>
                        <div className="flex gap-3 mt-4 text-xs font-mono text-slate-400">
                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">📅 {new Date(job.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">⛽ {job.fuelType}</span>
                        </div>
                    </div>

                    {/* LIVE STATUS TRACKER */}
                    <div className={`${theme.card} p-6 rounded-2xl`}>
                        <h3 className="text-xs font-bold uppercase text-slate-500 mb-6 tracking-widest">Live Workshop Status</h3>
                        
                        {/* PROGRESS BAR */}
                        <div className="relative mb-8 px-2">
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -z-0 rounded"></div>
                            <div className="absolute top-1/2 left-0 h-1 bg-blue-500 transition-all duration-1000 -z-0 rounded" style={{ width: `${percent}%` }}></div>
                            
                            <div className="flex justify-between relative z-10">
                                {['Received', 'Repairing', 'QC Check', 'Ready'].map((step, i) => (
                                    <div key={step} className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${i <= currentIdx ? 'bg-slate-900 border-blue-500 text-blue-500' : 'bg-slate-800 border-slate-600 text-slate-600'}`}>
                                            {i < currentIdx ? '✓' : i === currentIdx ? <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" /> : <div className="w-2 h-2 bg-slate-600 rounded-full" />}
                                        </div>
                                        <span className={`text-[10px] mt-2 font-bold uppercase transition-all ${i <= currentIdx ? 'text-white' : 'text-slate-600'}`}>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CONTEXT MESSAGE */}
                        <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl text-center">
                            {job.status === 'ESTIMATE' && <p className="text-blue-300 text-sm">Waiting for approval. Please check details below.</p>}
                            {job.status === 'WORK_IN_PROGRESS' && <p className="text-green-400 text-sm font-bold animate-pulse">🔧 Technician is currently working on your vehicle.</p>}
                            {job.status === 'WORK_PAUSED' && <p className="text-yellow-400 text-sm">⚠️ Work Paused: {job.pauseReason || 'Waiting for parts'}</p>}
                            {job.status === 'READY' && <p className="text-green-400 text-sm font-bold">✅ Your vehicle is ready for pickup!</p>}
                        </div>
                    </div>

                    {/* PHOTO EVIDENCE (Gallery) */}
                    {(job.inspectionPhotos?.length > 0) && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold uppercase text-slate-500 ml-1">Inspection Gallery</h3>
                            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                                {job.inspectionPhotos.map((img, i) => (
                                    <img key={i} src={img} className="h-32 w-auto rounded-xl border border-slate-700 shadow-lg object-cover" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FINANCIAL SUMMARY */}
                    <div className={`${theme.card} p-6 rounded-2xl`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold uppercase text-slate-500">Estimated Bill</h3>
                            {job.status === 'ESTIMATE' && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded font-bold">APPROVAL PENDING</span>}
                        </div>
                        
                        <div className="space-y-3 mb-4">
                            {job.parts?.map((part, i) => (
                                <div key={i} className="flex justify-between text-sm border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">{part.desc}</span>
                                    <span className="font-mono text-slate-500">₹{part.total}</span>
                                </div>
                            ))}
                            {job.labor?.map((lab, i) => (
                                <div key={i} className="flex justify-between text-sm border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">{lab.desc}</span>
                                    <span className="font-mono text-slate-500">₹{lab.total}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-600">
                            <span className="font-bold text-lg text-white">TOTAL</span>
                            <span className="font-black text-2xl text-green-400">₹{total.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* FOOTER ACTIONS */}
                    <div className="grid grid-cols-2 gap-4 pb-10">
                        <button onClick={() => window.open(`https://wa.me/919876543210?text=Query regarding ${job.regNo}`, '_blank')} className="bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                            <span>💬</span> WhatsApp Us
                        </button>
                        <button onClick={() => window.open(`tel:9876543210`)} className="bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                            <span>📞</span> Call Advisor
                        </button>
                    </div>

                </div>
            );
        })()}

      </div>
    </div>
  );
}