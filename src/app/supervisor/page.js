"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState('DASHBOARD'); 
  const [jobs, setJobs] = useState([]);
  
  // --- MASTER DATA STRUCTURE ---
  const [formData, setFormData] = useState({
    // Identity
    vehicleNumber: '', make: '', model: '', vin: '',
    color: '', fuelType: 'Petrol',
    
    // Vitals
    odometer: '', fuelLevel: '50',
    
    // The Job
    jobType: 'PMS',
    technicianName: '',
    customerName: '', customerPhone: '',
    
    // Diagnostics
    supervisorObs: '', // Pre-Service Drive
    obdCodes: '',      
    obdFileName: '',   // Stores filename
    
    // Instructions
    complaints: '',    
    instructions: '',  
    
    status: 'PENDING', 
    estimatedCost: ''
  });

  // LISTEN TO DB
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.vehicleNumber) return;
    
    await addDoc(collection(db, "jobs"), { 
      ...formData, 
      createdAt: serverTimestamp(),
      photoEvidence: ['Front', 'Back', 'Left', 'Right'] 
    });
    
    alert("Job Card Created Successfully!");
    // Reset basic fields
    setFormData({ ...formData, vehicleNumber: '', complaints: '', odometer: '', obdFileName: '' });
    setActiveTab('DASHBOARD');
  };

  const deleteJob = async (id) => {
    if(confirm("Delete this Job Card?")) await deleteDoc(doc(db, "jobs", id));
  };

  // Fake File Handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, obdFileName: file.name });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      
      {/* NAVBAR */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black text-blue-500">JOB<span className="text-white">CARD</span></h1>
            <div className="flex bg-slate-900 rounded-lg p-1 ml-8">
              <button onClick={() => setActiveTab('DASHBOARD')} className={`px-4 py-1 rounded text-sm font-bold transition-all ${activeTab === 'DASHBOARD' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>📡 Live Fleet</button>
              <button onClick={() => setActiveTab('NEW_ENTRY')} className={`px-4 py-1 rounded text-sm font-bold transition-all ${activeTab === 'NEW_ENTRY' ? 'bg-green-600 text-white' : 'text-slate-400'}`}>➕ New Job</button>
            </div>
          </div>
          <Link href="/" className="text-slate-500 hover:text-white text-sm">Exit</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        
        {/* ================= FORM VIEW ================= */}
        {activeTab === 'NEW_ENTRY' && (
          <div className="max-w-5xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-green-400 border-b border-slate-700 pb-2">Create Comprehensive Job Card</h2>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* --- ROW 1: VEHICLE DNA --- */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div className="col-span-1 md:col-span-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Registration</label>
                  <input required type="text" placeholder="KA-01..." className="w-full bg-slate-800 border border-slate-600 rounded p-2 uppercase font-mono text-lg text-yellow-400" 
                    value={formData.vehicleNumber} onChange={(e) => setFormData({...formData, vehicleNumber: e.target.value.toUpperCase()})} />
                </div>
                <div>
                   <label className="text-[10px] text-slate-500 uppercase font-bold">Model</label>
                   <input required type="text" placeholder="e.g. Swift" className="w-full bg-slate-800 border border-slate-600 rounded p-2" 
                    value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] text-slate-500 uppercase font-bold">Color</label>
                   <input type="text" placeholder="e.g. Red" className="w-full bg-slate-800 border border-slate-600 rounded p-2" 
                    value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] text-slate-500 uppercase font-bold">Fuel Type</label>
                   <select className="w-full bg-slate-800 border border-slate-600 rounded p-2" value={formData.fuelType} onChange={(e) => setFormData({...formData, fuelType: e.target.value})}>
                      <option>Petrol</option>
                      <option>Diesel</option>
                      <option>CNG</option>
                      <option>Electric</option>
                   </select>
                </div>
              </div>

              {/* --- ROW 2: VITALS & TYPE --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold">Odometer (KM)</label>
                  <input required type="number" placeholder="0" className="w-full bg-slate-900 border border-slate-600 rounded p-3 font-mono" 
                    value={formData.odometer} onChange={(e) => setFormData({...formData, odometer: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold">Job Type</label>
                   <select className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-blue-400 font-bold" value={formData.jobType} onChange={(e) => setFormData({...formData, jobType: e.target.value})}>
                      <option value="PMS">PMS (General Service)</option>
                      <option value="Running Repair">Running Repair</option>
                      <option value="Accidental">Accidental</option>
                      <option value="Breakdown">Breakdown</option>
                   </select>
                </div>
                <div>
                   <label className="text-xs text-slate-500 uppercase font-bold">Fuel Level</label>
                   <input type="range" className="w-full mt-3 accent-green-500" value={formData.fuelLevel} onChange={(e) => setFormData({...formData, fuelLevel: e.target.value})} />
                </div>
              </div>

              {/* --- ROW 3: DIAGNOSTICS & OBS --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* LEFT: PRE-SERVICE DRIVE */}
                 <div className="flex flex-col h-full">
                    <label className="text-xs text-yellow-500 uppercase font-bold mb-2">🚗 Pre-Service Drive (Supervisor Obs)</label>
                    <textarea rows="4" placeholder="How does the car drive? Note noises, vibrations, clutch feel..." className="w-full bg-slate-900 border border-yellow-500/30 rounded p-3 flex-grow"
                      value={formData.supervisorObs} onChange={(e) => setFormData({...formData, supervisorObs: e.target.value})} />
                 </div>

                 {/* RIGHT: OBD SCAN DATA (TEXT + FILE) */}
                 <div className="bg-slate-900 border border-red-500/30 rounded p-4">
                    <label className="text-xs text-red-400 uppercase font-bold block mb-2">💻 OBD Scan Report (Text/File)</label>
                    
                    {/* Text Input */}
                    <textarea rows="2" placeholder="e.g. P0300 Misfire..." className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-sm mb-3"
                      value={formData.obdCodes} onChange={(e) => setFormData({...formData, obdCodes: e.target.value})} />
                    
                    {/* File Input */}
                    <div className="relative border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:bg-slate-800 transition-colors">
                      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="text-slate-400">
                        {formData.obdFileName ? (
                          <span className="text-green-400 font-bold">📄 {formData.obdFileName}</span>
                        ) : (
                          <span className="text-xs">📤 Upload Scan Report (PDF/IMG)</span>
                        )}
                      </div>
                    </div>
                 </div>
              </div>

              {/* --- ROW 4: CUSTOMER COMPLAINTS & INSTRUCTIONS --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="text-xs text-slate-500 uppercase font-bold">🗣️ Customer Complaints</label>
                    <textarea required rows="4" placeholder="List what customer said..." className="w-full bg-slate-900 border border-slate-600 rounded p-3"
                      value={formData.complaints} onChange={(e) => setFormData({...formData, complaints: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-xs text-blue-400 uppercase font-bold">🔧 Instructions to Technician</label>
                    <textarea required rows="4" placeholder="Technical steps: 1. Clean throttle body 2. Check pads..." className="w-full bg-slate-900 border border-blue-500/30 rounded p-3"
                      value={formData.instructions} onChange={(e) => setFormData({...formData, instructions: e.target.value})} />
                 </div>
              </div>

              {/* --- ROW 5: VISUAL PROOF (UI Only) --- */}
              <div className="bg-black/20 p-6 rounded-xl border border-dashed border-slate-600">
                 <h3 className="text-xs text-slate-400 uppercase font-bold mb-4">📸 Vehicle Condition Uploads</h3>
                 <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {['Front', 'Rear', 'Left', 'Right', 'Interior', 'Engine'].map((view) => (
                      <div key={view} className="aspect-square bg-slate-800 rounded border border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 hover:border-blue-500 transition-all">
                         <span className="text-2xl opacity-50">📷</span>
                         <span className="text-[10px] mt-1 uppercase text-slate-500">{view}</span>
                      </div>
                    ))}
                 </div>
              </div>

              {/* --- SUBMIT (WITH DROPDOWN) --- */}
              <div className="flex gap-4 items-end pt-4">
                 <div className="flex-grow">
                    <label className="text-xs text-slate-500 uppercase font-bold">Assign Tech</label>
                    <select 
                       className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white appearance-none cursor-pointer" 
                       value={formData.technicianName} 
                       onChange={(e) => setFormData({...formData, technicianName: e.target.value})}
                    >
                       <option value="">-- Select Mechanic --</option>
                       <option value="Raju Mechanic">Raju Mechanic</option>
                       <option value="John Doe">John Doe</option>
                       <option value="Electrical Specialist">Electrical Specialist</option>
                       <option value="Helper 01">Helper 01</option>
                       <option value="Expert Team">Expert Team (All Access)</option>
                    </select>
                 </div>
                 <button type="submit" className="w-2/3 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg">
                   GENERATE JOB CARD
                 </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= DASHBOARD VIEW ================= */}
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {jobs.map((job) => (
               <div key={job.id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-blue-500 transition-all shadow-lg">
                  <div className="flex justify-between items-start mb-2">
                     <h3 className="text-xl font-bold text-white">{job.vehicleNumber}</h3>
                     <span className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300">{job.jobType || 'PMS'}</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">{job.model} ({job.fuelType})</p>
                  
                  <div className="text-xs text-slate-500 space-y-1 mb-4 border-l-2 border-slate-700 pl-3">
                     <p>🎨 Color: {job.color || 'N/A'}</p>
                     <p>📟 ODO: {job.odometer} km</p>
                     <p>⚠️ Pre-Service Obs: {job.supervisorObs ? 'Yes' : 'No'}</p>
                     {job.obdFileName && <p className="text-green-400">📄 Scan Report: Attached</p>}
                  </div>

                  <div className="flex gap-2 border-t border-slate-700 pt-3">
                     <Link href={`/bill/${job.id}`} className="flex-1 text-center bg-blue-900/20 text-blue-400 py-2 rounded text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">Invoice</Link>
                     <button onClick={() => deleteJob(job.id)} className="px-3 py-2 bg-red-900/20 text-red-400 rounded hover:bg-red-600 hover:text-white transition-all">🗑️</button>
                  </div>
               </div>
             ))}
          </div>
        )}

      </div>
    </div>
  );
}