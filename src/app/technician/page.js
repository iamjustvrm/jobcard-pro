"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

export default function TechnicianDashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // LISTEN TO DATABASE
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc")); // Now sorts by newest first
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

  // UPDATE STATUS
  const updateStatus = async (jobId, newStatus) => {
    const jobRef = doc(db, "jobs", jobId);
    await updateDoc(jobRef, { status: newStatus });
  };

  if (loading) return <div className="min-h-screen bg-slate-900 text-white p-10 flex items-center justify-center">Loading Job Board...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
      
      {/* Header */}
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-500">Live Job Board</h1>
          <p className="text-slate-400 text-sm">Active Vehicles: {jobs.length}</p>
        </div>
        <Link href="/" className="bg-slate-800 px-4 py-2 rounded text-slate-300 hover:text-white transition-colors">
          Exit
        </Link>
      </div>

      {/* THE JOB GRID */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {jobs.length === 0 && (
          <div className="col-span-full text-center text-slate-500 py-20">No jobs active.</div>
        )}

        {jobs.map((job) => (
          <div key={job.id} className={`flex flex-col relative p-6 rounded-2xl border-2 transition-all ${
            job.status === 'PENDING' ? 'border-orange-500/50 bg-slate-800/50' :
            job.status === 'WIP' ? 'border-blue-500 bg-slate-800 shadow-[0_0_20px_rgba(59,130,246,0.2)]' :
            'border-green-500/50 bg-slate-800/50 opacity-75'
          }`}>
            
            {/* Status Badge */}
            <div className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full ${
              job.status === 'PENDING' ? 'bg-orange-500/20 text-orange-400' :
              job.status === 'WIP' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
              'bg-green-500/20 text-green-400'
            }`}>
              {job.status}
            </div>

            {/* Vehicle Details */}
            <h2 className="text-2xl font-bold mb-1">{job.vehicleNumber}</h2>
            <p className="text-slate-400 text-sm mb-4 border-b border-slate-700 pb-4">
              {job.model} • <span className="text-blue-400">{job.technicianName}</span>
            </p>

            {/* --- NEW: Work Order Section --- */}
            <div className="flex-grow mb-6 bg-slate-900/50 p-4 rounded-lg">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Work Order:</h3>
              <p className="text-slate-300 whitespace-pre-line text-sm">
                {job.complaints || "No instructions provided."}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-auto">
              {job.status === 'PENDING' && (
                <button 
                  onClick={() => updateStatus(job.id, 'WIP')}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all active:scale-95">
                  ▶ START JOB
                </button>
              )}

              {job.status === 'WIP' && (
                <button 
                  onClick={() => updateStatus(job.id, 'DONE')}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all active:scale-95">
                  ⏹ FINISH JOB
                </button>
              )}

              {job.status === 'DONE' && (
                <div className="text-center text-green-500 font-mono text-sm py-3 bg-green-500/10 rounded-xl border border-green-500/20">
                  ✓ READY FOR QC
                </div>
              )}
            </div>

          </div>
        ))}

      </div>
    </div>
  );
}