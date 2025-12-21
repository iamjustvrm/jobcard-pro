"use client";
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../../../firebase'; 
import { useParams } from 'next/navigation';

export default function PrivateTracker() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchJob = async () => {
      try {
        if (!id) return;
        const docRef = doc(db, "jobs", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setJob({ id: docSnap.id, ...docSnap.data() });
        else setError("Job Card not found.");
      } catch (err) { setError("System Error."); } finally { setLoading(false); }
    };
    fetchJob();
  }, [id]);

  const getProgress = (status) => {
      const stages = ['ESTIMATE', 'WORK_IN_PROGRESS', 'READY', 'DELIVERED'];
      let idx = stages.indexOf(status);
      if (status === 'WORK_PAUSED') idx = 1; if (idx === -1) idx = 0;
      return { idx, percent: (idx / (stages.length - 1)) * 100 };
  };

  const theme = {
      bg: "bg-[#0f172a]", card: "bg-[#1e293b] border border-slate-700/50 shadow-xl", 
      textMain: "text-slate-100", textSub: "text-slate-400", success: "text-emerald-400",
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.textMain}`}>LOADING...</div>;
  if (error) return <div className={`min-h-screen flex items-center justify-center ${theme.bg} text-red-400`}>{error}</div>;
  if (!job) return null;

  const { idx, percent } = getProgress(job.status);
  const total = (job.parts?.reduce((a,b)=>a+(Number(b.total)||0),0)||0) + (job.labor?.reduce((a,b)=>a+(Number(b.total)||0),0)||0);

  return (
    <div className={`min-h-screen ${theme.bg} font-sans selection:bg-blue-500/30`}>
      
      {/* 1. PROFESSIONAL HEADER (No Emoji) */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900/20 to-slate-900 border-b border-slate-800 pb-8 pt-8 px-6 text-center">
        <h2 className="text-xs font-bold tracking-[0.3em] uppercase text-blue-400 mb-2">Welcome to Premium Service</h2>
        <h1 className={`text-3xl font-black uppercase ${theme.textMain} tracking-tight`}>{job.regNo}</h1>
        <p className={`${theme.textSub} text-sm mt-1`}>{job.model} • {job.customerName}</p>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-6">

        {/* 2. LIVE STATUS */}
        <div className={`${theme.card} p-6 rounded-2xl`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${theme.textSub}`}>Status</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold bg-blue-500/20 text-blue-400`}>{job.status.replace(/_/g, ' ')}</span>
            </div>
            <div className="relative mb-8 px-2">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700/50 -z-0 rounded-full"></div>
                <div className="absolute top-1/2 left-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-1000 -z-0 rounded-full" style={{ width: `${percent}%` }}></div>
                <div className="flex justify-between relative z-10">
                    {['Received', 'Repair', 'QC', 'Ready'].map((step, i) => (
                        <div key={step} className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${i <= idx ? 'bg-[#0f172a] border-blue-500 text-blue-500 shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-700'}`}>{i < idx ? '✓' : i === idx ? <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" /> : <div className="w-2 h-2 bg-slate-700 rounded-full" />}</div>
                            <span className={`text-[9px] mt-2 font-bold uppercase ${i <= idx ? theme.textMain : 'text-slate-700'}`}>{step}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl text-center">
                 {job.status === 'ESTIMATE' && <p className="text-amber-400">📝 Estimate Awaiting Approval</p>}
                 {job.status === 'WORK_IN_PROGRESS' && <p className="text-blue-400">🔧 Technician is working.</p>}
                 {job.status === 'READY' && <p className={theme.success}>✅ Ready for Pickup!</p>}
            </div>
        </div>

        {/* 3. SNAPSHOT */}
        <div className={`${theme.card} rounded-2xl p-6`}>
            <h3 className={`text-xs font-bold uppercase tracking-widest ${theme.textSub} mb-4`}>Vehicle Snapshot</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/50 p-3 rounded"><div className="text-[10px] text-slate-500 uppercase">Odometer In</div><div className={`text-lg font-mono ${theme.textMain}`}>{job.odometer} km</div></div>
                <div className="bg-slate-900/50 p-3 rounded"><div className="text-[10px] text-slate-500 uppercase">Fuel Level</div><div className={`text-lg font-mono ${theme.textMain}`}>{job.fuelLevel || 0}%</div></div>
            </div>
            <div>
                <div className="text-[10px] text-slate-500 uppercase mb-2">Reported Issues</div>
                <div className="bg-slate-900/50 p-3 rounded text-sm text-slate-300">{job.complaints || 'General Service'}</div>
            </div>
        </div>

        {/* 4. FINANCIAL SUMMARY */}
        <div className={`${theme.card} rounded-2xl p-6`}>
            <div className="flex justify-between items-end border-b border-slate-700/50 pb-4 mb-4">
                <span className="text-xs text-slate-500 uppercase">Total Estimate</span>
                <span className={`text-3xl font-black ${theme.success}`}>₹{total.toLocaleString()}</span>
            </div>
            <div className="space-y-2">
                {job.parts?.map((p,i)=><div key={i} className="flex justify-between text-sm"><span className="text-slate-400">{p.desc}</span><span className="text-slate-500">₹{p.total}</span></div>)}
                {job.labor?.map((l,i)=><div key={i} className="flex justify-between text-sm"><span className="text-slate-400">{l.desc}</span><span className="text-slate-500">₹{l.total}</span></div>)}
            </div>
        </div>

        {/* 5. CONTACT */}
        <div className="grid grid-cols-2 gap-4 text-center">
            <button onClick={() => window.open(`https://wa.me/919876543210?text=Ref: Job ${job.regNo}`, '_blank')} className="bg-[#25D366] text-white py-3 rounded-xl font-bold text-sm shadow-lg">WhatsApp Us</button>
            <button onClick={() => window.open(`tel:9876543210`)} className="bg-slate-800 text-white py-3 rounded-xl font-bold text-sm border border-slate-700">Call Us</button>
        </div>

      </div>
    </div>
  );
}