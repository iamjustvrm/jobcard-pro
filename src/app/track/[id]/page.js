"use client";
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../../../firebase'; 
import { useParams } from 'next/navigation';

export default function PrivateTracker() {
  const { id } = useParams(); // Get the "Magic ID" from URL
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 📡 FETCH JOB BY ID
  useEffect(() => {
    const fetchJob = async () => {
      try {
        if (!id) return;
        const docRef = doc(db, "jobs", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setJob({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError("Job Card not found. Please check the link.");
        }
      } catch (err) {
        console.error(err);
        setError("System Error. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  // 📊 PROGRESS LOGIC
  const getProgress = (status) => {
      const stages = ['ESTIMATE', 'WORK_IN_PROGRESS', 'READY', 'DELIVERED'];
      let idx = stages.indexOf(status);
      if (status === 'WORK_PAUSED') idx = 1; 
      if (idx === -1) idx = 0;
      return { idx, percent: (idx / (stages.length - 1)) * 100 };
  };

  // 🎨 THEME CONFIG (Soothing Dark Mode)
  const theme = {
      bg: "bg-[#0f172a]", // Slate 900
      card: "bg-[#1e293b] border border-slate-700/50 shadow-xl", // Slate 800
      textMain: "text-slate-100",
      textSub: "text-slate-400",
      accent: "text-blue-400",
      success: "text-emerald-400",
      warning: "text-amber-400"
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.textMain}`}><div className="animate-pulse text-xl font-light tracking-widest">LOADING STATUS...</div></div>;
  if (error) return <div className={`min-h-screen flex items-center justify-center ${theme.bg} text-red-400`}>{error}</div>;
  if (!job) return null;

  const { idx, percent } = getProgress(job.status);
  const total = (job.parts?.reduce((a,b)=>a+(Number(b.total)||0),0)||0) + (job.labor?.reduce((a,b)=>a+(Number(b.total)||0),0)||0);

  return (
    <div className={`min-h-screen ${theme.bg} font-sans selection:bg-blue-500/30`}>
      
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-800 to-[#0f172a] pb-10 pt-8 px-6 border-b border-slate-800">
        <div className="max-w-md mx-auto relative z-10 text-center">
            <div className="inline-block p-3 rounded-full bg-blue-500/10 mb-4 animate-bounce-slow">
                <span className="text-4xl">🚘</span>
            </div>
            <h1 className={`text-4xl font-black tracking-tighter uppercase ${theme.textMain} mb-2`}>{job.regNo}</h1>
            <p className={`${theme.textSub} font-medium text-lg`}>{job.model} <span className="text-slate-600 mx-2">•</span> {job.customerName}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 -mt-8 relative z-20 space-y-6">

        {/* 2. LIVE STATUS PULSE */}
        <div className={`${theme.card} p-6 rounded-2xl`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${theme.textSub}`}>Live Status</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${job.status === 'WORK_PAUSED' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {job.status.replace(/_/g, ' ')}
                </span>
            </div>
            
            {/* PROGRESS BAR */}
            <div className="relative mb-8 px-2">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700/50 -z-0 rounded-full"></div>
                <div className="absolute top-1/2 left-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-1000 -z-0 rounded-full" style={{ width: `${percent}%` }}></div>
                
                <div className="flex justify-between relative z-10">
                    {['Received', 'Repair', 'QC', 'Ready'].map((step, i) => (
                        <div key={step} className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${i <= idx ? 'bg-[#0f172a] border-blue-500 text-blue-500 shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-700'}`}>
                                {i < idx ? '✓' : i === idx ? <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" /> : <div className="w-2 h-2 bg-slate-700 rounded-full" />}
                            </div>
                            <span className={`text-[9px] mt-2 font-bold uppercase tracking-wide transition-all ${i <= idx ? theme.textMain : 'text-slate-700'}`}>{step}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* CONTEXT NOTE */}
            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl text-center backdrop-blur-sm">
                 {job.status === 'ESTIMATE' && <p className={theme.warning}>📝 Estimate generated. Awaiting approval via WhatsApp.</p>}
                 {job.status === 'WORK_IN_PROGRESS' && <p className={theme.accent}>🔧 Technician is actively working on your vehicle.</p>}
                 {job.status === 'WORK_PAUSED' && <p className="text-red-400">⏸️ Work Paused: {job.pauseReason || 'Pending Parts'}</p>}
                 {job.status === 'READY' && <p className={theme.success}>✅ Vehicle is Ready! You can pick it up now.</p>}
                 {job.status === 'DELIVERED' && <p className={theme.textSub}>👋 Delivered. Drive Safe!</p>}
            </div>
        </div>

        {/* 3. INTAKE SNAPSHOT (Odometer & Issues) */}
        <div className={`${theme.card} rounded-2xl overflow-hidden`}>
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${theme.textSub}`}>Intake Snapshot</h3>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6">
                <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Odometer (In)</div>
                    <div className={`text-xl font-mono ${theme.textMain}`}>{job.odometer} <span className="text-sm text-slate-500">km</span></div>
                </div>
                <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Fuel Level</div>
                    <div className={`text-xl font-mono ${theme.textMain}`}>{job.fuelLevel || 0}<span className="text-sm text-slate-500">%</span></div>
                </div>
            </div>
            
            {/* CUSTOMER COMPLAINTS */}
            <div className="px-6 pb-6 pt-0">
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-3">Issues You Reported</div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30 space-y-2">
                    {job.complaints ? (
                        job.complaints.split(',').map((issue, i) => (
                            <div key={i} className="flex gap-3 items-start">
                                <span className="text-blue-500 mt-1">●</span>
                                <span className={`${theme.textSub} text-sm`}>{issue.trim()}</span>
                            </div>
                        ))
                    ) : <span className="text-slate-600 italic text-sm">General Service</span>}
                </div>
            </div>
        </div>

        {/* 4. PHOTO EVIDENCE (Horizontal Scroll) */}
        {(job.inspectionPhotos?.length > 0) && (
            <div className="space-y-3">
                <h3 className={`text-xs font-bold uppercase tracking-widest ml-1 ${theme.textSub}`}>Intake Photos</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                    {job.inspectionPhotos.map((img, i) => (
                        <img key={i} src={img} className="h-40 w-auto rounded-xl border border-slate-700/50 shadow-lg object-cover snap-center" />
                    ))}
                </div>
            </div>
        )}

        {/* 5. FINANCIALS & APPROVALS */}
        <div className={`${theme.card} rounded-2xl overflow-hidden`}>
             <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${theme.textSub}`}>Job Summary</h3>
                {job.status === 'ESTIMATE' ? 
                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">PENDING APPROVAL</span> :
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">APPROVED</span>
                }
            </div>
            <div className="p-6">
                <div className="space-y-3 mb-6">
                    {/* PARTS */}
                    {job.parts?.map((part, i) => (
                        <div key={i} className="flex justify-between text-sm group">
                            <span className="text-slate-300 group-hover:text-white transition-colors">{part.desc}</span>
                            <div className="flex items-center gap-3">
                                {/* Invisible 'Approved' check for visual reassurance */}
                                <span className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✓ Approved</span>
                                <span className="font-mono text-slate-500">₹{part.total}</span>
                            </div>
                        </div>
                    ))}
                    {/* LABOR */}
                    {job.labor?.map((lab, i) => (
                        <div key={i} className="flex justify-between text-sm group">
                            <span className="text-slate-300 group-hover:text-white transition-colors">{lab.desc}</span>
                            <span className="font-mono text-slate-500">₹{lab.total}</span>
                        </div>
                    ))}
                </div>

                <div className="border-t border-slate-700/50 pt-4 flex justify-between items-end">
                    <div className="text-xs text-slate-500">
                        Total Estimate<br/>(Inc. Taxes)
                    </div>
                    <div className={`text-3xl font-black ${theme.success}`}>₹{total.toLocaleString()}</div>
                </div>
            </div>
        </div>

        {/* 6. CONTACT FOOTER */}
        <div className="text-center space-y-4 pb-10">
            <p className="text-xs text-slate-500">Need to change something? Approvals are managed via WhatsApp.</p>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => window.open(`https://wa.me/919876543210?text=Ref: Job ${job.regNo}`, '_blank')} className="bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-green-900/20 transition-transform active:scale-95">
                    WhatsApp Advisor
                </button>
                <button onClick={() => window.open(`tel:9876543210`)} className="bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm border border-slate-700 shadow-lg transition-transform active:scale-95">
                    Call Workshop
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}