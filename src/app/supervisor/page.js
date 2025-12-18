"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function SupervisorDashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    model: '',
    technicianName: '',
    complaints: '',
    estimatedCost: '', // <--- MONEY FIELD (Only for you)
    status: 'PENDING'
  });

  // 1. LISTEN TO DATABASE (Real-time)
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. CREATE JOB
  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.vehicleNumber) return;
    await addDoc(collection(db, "jobs"), { ...formData, createdAt: serverTimestamp() });
    setFormData({ vehicleNumber: '', model: '', technicianName: '', complaints: '', estimatedCost: '', status: 'PENDING' });
    alert("Vehicle Added!");
  };

  // 3. DELETE JOB (Supervisor Only Power)
  const deleteJob = async (id) => {
    if(confirm("Are you sure you want to remove this vehicle?")) {
      await deleteDoc(doc(db, "jobs", id));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold text-blue-500">Supervisor <span className="text-white">Command Center</span></h1>
           <p className="text-slate-400 text-sm">Overview: {jobs.length} Active Jobs</p>
        </div>
        <Link href="/" className="bg-slate-800 px-4 py-2 rounded text-slate-300 hover:text-white">Exit</Link>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT COLUMN: CREATE NEW JOB --- */}
        <div className="lg:col-span-1 bg-slate-800 p-6 rounded-2xl border border-slate-700 h-fit sticky top-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">📝 New Entry</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required type="text" placeholder="Vehicle No (e.g. KA-01...)" className="w-full bg-slate-900 border border-slate-700 rounded p-3 font-mono uppercase" value={formData.vehicleNumber} onChange={(e) => setFormData({...formData, vehicleNumber: e.target.value.toUpperCase()})} />
            <input required type="text" placeholder="Model (e.g. Swift)" className="w-full bg-slate-900 border border-slate-700 rounded p-3" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} />
            
            <select className="w-full bg-slate-900 border border-slate-700 rounded p-3" value={formData.technicianName} onChange={(e) => setFormData({...formData, technicianName: e.target.value})}>
              <option value="">Assign Mechanic...</option>
              <option value="Raju Mechanic">Raju Mechanic</option>
              <option value="John Doe">John Doe</option>
            </select>

            <textarea placeholder="Complaints..." rows="2" className="w-full bg-slate-900 border border-slate-700 rounded p-3" value={formData.complaints} onChange={(e) => setFormData({...formData, complaints: e.target.value})} />

            {/* $$$ THE MONEY FIELD $$$ */}
            <div className="p-3 bg-green-900/20 border border-green-500/30 rounded">
              <label className="text-xs text-green-400 font-bold uppercase">Estimated Billing (₹)</label>
              <input type="number" placeholder="0.00" className="w-full bg-transparent text-green-400 font-mono text-xl outline-none" value={formData.estimatedCost} onChange={(e) => setFormData({...formData, estimatedCost: e.target.value})} />
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all">Add to Fleet</button>
          </form>
        </div>

        {/* --- RIGHT COLUMN: LIVE FLEET BOARD --- */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold mb-4">👀 Live Workshop Floor</h2>
          
          {jobs.length === 0 && <div className="text-slate-500">No vehicles in the workshop.</div>}

          {jobs.map((job) => (
            <div key={job.id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex justify-between items-center hover:border-blue-500 transition-all">
              
              {/* Car Info */}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold font-mono">{job.vehicleNumber}</h3>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    job.status === 'PENDING' ? 'bg-orange-500/20 text-orange-400' :
                    job.status === 'WIP' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{job.model} • <span className="text-blue-300">{job.technicianName}</span></p>
                
                {/* FINANCIALS (Visible Only to You) */}
                <div className="mt-2 text-green-400 font-mono text-sm flex items-center gap-2">
                  <span>💰 Est: ₹{job.estimatedCost || '0'}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-2">
                <button onClick={() => deleteJob(job.id)} className="text-red-400 hover:text-red-300 text-xs border border-red-400/30 px-3 py-2 rounded">
                  {/* Controls */}
              <div className="flex flex-col gap-2">
                
                {/* --- NEW BILL BUTTON --- */}
                <Link href={`/bill/${job.id}`} className="text-center text-blue-400 hover:text-blue-300 text-xs border border-blue-400/30 px-3 py-2 rounded hover:bg-blue-900/20">
                   🖨️ Invoice
                </Link>
                
                <button onClick={() => deleteJob(job.id)} className="text-red-400 hover:text-red-300 text-xs border border-red-400/30 px-3 py-2 rounded hover:bg-red-900/20">
                  🗑️ Remove
                </button>
              </div>
                  🗑️ Remove
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}