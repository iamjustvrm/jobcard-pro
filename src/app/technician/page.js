"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const AUTH_DB = [
  { id: 'raju', pass: '1234', name: 'Raju Mechanic', role: 'TECH' },
  { id: 'john', pass: '1234', name: 'John Doe', role: 'TECH' },
  { id: 'elec', pass: '1234', name: 'Electrical Specialist', role: 'TECH' },
  { id: 'help', pass: '1234', name: 'Helper 01', role: 'TECH' },
  { id: 'admin', pass: 'admin', name: 'Expert Team', role: 'SUPER_ADMIN' }
];

// QC CHECKLIST TEMPLATE
const QC_CHECKLIST_TEMPLATE = {
  verification: { label: "1. Verification", items: { repairsComplete: "Repairs Complete", partsReplaced: "Parts Replaced" } },
  fluids: { label: "2. Fluids", items: { engineOil: "Engine Oil Level", coolant: "Coolant Level", brakeFluid: "Brake Fluid", washer: "Washer Fluid" } },
  exterior: { label: "3. Exterior", items: { scratches: "No New Scratches", lights: "All Lights Working", wipers: "Wipers Check", horn: "Horn Check" } },
  testDrive: { label: "5. Test Drive", items: { start: "Engine Start", brakes: "Brakes Firm", noises: "No Unusual Noises", steering: "Steering Straight" } },
  final: { label: "6. Final & Docs", items: { torque: "Wheel Torque Spec", obdFinal: "Final OBD Scan Report", serviceBook: "Service Book Stamped" } }
};

export default function TechnicianDashboard() {
  const [user, setUser] = useState(null);
  const [inputID, setInputID] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [jobs, setJobs] = useState([]);
  
  // MODAL STATES
  const [activeModal, setActiveModal] = useState(null); 
  const [currentJobId, setCurrentJobId] = useState(null);
  const [checklistData, setChecklistData] = useState({}); 

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc")); 
    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = AUTH_DB.find(u => u.id === inputID.toLowerCase() && u.pass === inputPass);
    if (foundUser) { setUser(foundUser); setErrorMsg(''); } else { setErrorMsg('❌ Invalid ID'); }
  };

  const openBlockModal = (job, blockType) => {
    setCurrentJobId(job.id);
    setActiveModal(blockType);
    if (blockType === 'qc') {
      setChecklistData(job.detailedQC || {});
    } else {
      setChecklistData(job.taskStatus || {});
    }
  };

  const toggleCheck = (key, category = null) => {
    if (activeModal === 'qc') {
      setChecklistData(prev => ({
        ...prev,
        [category]: { ...prev[category], [key]: !prev[category]?.[key] }
      }));
    } else {
      setChecklistData(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const submitBlock = async () => {
    if (!currentJobId) return;
    const jobRef = doc(db, "jobs", currentJobId);
    
    if (activeModal === 'qc') {
      await updateDoc(jobRef, { detailedQC: checklistData, 'blocks.qc': 'DONE' });
    } else {
      await updateDoc(jobRef, { 
        taskStatus: checklistData, 
        [`blocks.${activeModal === 'mech' ? 'mechanical' : 'electrical'}`]: 'DONE' 
      });
    }
    setActiveModal(null);
    setCurrentJobId(null);
  };

  const myJobs = user?.role === 'SUPER_ADMIN' ? jobs : jobs.filter(job => job.technicianName === user?.name);

  // ================= VIEW 1: LOGIN (WITH EXIT BUTTON) =================
  if (!user) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
        <h1 className="text-3xl font-black text-center text-blue-500 mb-8">Technician Portal</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input autoFocus type="text" placeholder="User ID" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 outline-none focus:border-blue-500 transition-all" value={inputID} onChange={(e) => setInputID(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 outline-none focus:border-blue-500 transition-all" value={inputPass} onChange={(e) => setInputPass(e.target.value)} />
          {errorMsg && <div className="text-red-400 text-center font-bold">{errorMsg}</div>}
          <button className="w-full bg-blue-600 py-4 rounded-xl font-bold hover:bg-blue-500 transition-all">LOGIN</button>
        </form>

        {/* --- NEW EXIT BUTTON --- */}
        <div className="mt-8 pt-6 border-t border-slate-700 text-center">
          <Link href="/" className="text-slate-400 hover:text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors">
            ⬅ Exit to Main Dashboard
          </Link>
        </div>

      </div>
    </div>
  );

  // ================= VIEW 2: DASHBOARD =================
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans">
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <h1 className="text-lg font-bold text-slate-400">Operator: <span className="text-blue-500">{user.name}</span></h1>
        
        <div className="flex gap-4 items-center">
            {/* Direct Home Link for logged in user */}
            <Link href="/" className="text-slate-500 hover:text-white text-xs">Home</Link>
            <button onClick={() => setUser(null)} className="bg-slate-800 px-3 py-1 rounded text-red-400 text-xs font-bold border border-slate-600 hover:bg-red-900/20">Logout</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {myJobs.map((job) => (
          <div key={job.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-700 bg-slate-800 flex justify-between">
               <div>
                 <h2 className="text-3xl font-black font-mono text-white">{job.vehicleNumber}</h2>
                 <p className="text-slate-400 text-sm">{job.model} • {job.jobType}</p>
               </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/30">
              {/* MECHANICAL BLOCK */}
              <div className={`p-4 rounded-xl border-2 ${job.blocks?.mechanical === 'DONE' ? 'border-green-500 bg-green-500/10' : 'border-orange-500 bg-slate-800'}`}>
                 <div className="flex justify-between mb-4"><h3 className="font-black text-slate-300">MECHANICAL</h3></div>
                 {job.blocks?.mechanical === 'DONE' ? <div className="text-green-500 font-bold text-center">COMPLETED</div> : 
                   <button onClick={() => openBlockModal(job, 'mech')} className="w-full py-3 bg-orange-600 rounded font-bold hover:bg-orange-500">▶ START TASKS</button>}
              </div>

              {/* ELECTRICAL BLOCK */}
              <div className={`p-4 rounded-xl border-2 ${job.blocks?.electrical === 'DONE' ? 'border-green-500 bg-green-500/10' : 'border-yellow-500 bg-slate-800'}`}>
                 <div className="flex justify-between mb-4"><h3 className="font-black text-slate-300">ELECTRICAL</h3></div>
                 {job.blocks?.electrical === 'DONE' ? <div className="text-green-500 font-bold text-center">COMPLETED</div> : 
                   <button onClick={() => openBlockModal(job, 'elec')} className="w-full py-3 bg-yellow-600 rounded font-bold hover:bg-yellow-500">▶ START TASKS</button>}
              </div>

              {/* QC BLOCK */}
              <div className={`p-4 rounded-xl border-2 ${job.blocks?.qc === 'DONE' ? 'border-green-500 bg-green-500/10' : 'border-blue-500 bg-slate-800'}`}>
                 <div className="flex justify-between mb-4"><h3 className="font-black text-slate-300">QC CHECK</h3></div>
                 {job.blocks?.qc === 'DONE' ? <div className="text-green-500 font-bold text-center">COMPLETED</div> : 
                   <button onClick={() => openBlockModal(job, 'qc')} className="w-full py-3 bg-blue-600 rounded font-bold hover:bg-blue-500">📋 START QC</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= UNIVERSAL TASK MODAL ================= */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-xl rounded-2xl border border-slate-600 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900 rounded-t-2xl">
              <h2 className="text-xl font-bold uppercase text-white">
                {activeModal === 'qc' ? '🛡️ Final QC Checklist' : `🔧 ${activeModal} Tasks`}
              </h2>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 text-2xl hover:text-white">×</button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              {/* CASE 1: QC MODAL */}
              {activeModal === 'qc' && Object.entries(QC_CHECKLIST_TEMPLATE).map(([catKey, category]) => (
                <div key={catKey}>
                  <h3 className="text-blue-400 font-bold text-xs uppercase mb-2">{category.label}</h3>
                  <div className="space-y-2">
                    {Object.entries(category.items).map(([key, label]) => (
                      <div key={key} onClick={() => toggleCheck(key, catKey)} className={`p-3 rounded border cursor-pointer flex gap-3 items-center ${checklistData[catKey]?.[key] ? 'bg-green-900/30 border-green-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                        <span className="text-lg">{checklistData[catKey]?.[key] ? '✅' : '⬜'}</span> <span className="text-sm">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* CASE 2: MECH/ELEC TASKS */}
              {activeModal !== 'qc' && (() => {
                 const job = jobs.find(j => j.id === currentJobId);
                 const taskList = activeModal === 'mech' ? job?.tasks?.mechanical : job?.tasks?.electrical;
                 
                 if (!taskList || taskList.length === 0) return <p className="text-slate-500 italic text-center">No specific tasks. Proceed with standard work.</p>;

                 return taskList.map((task) => (
                   <div key={task} onClick={() => toggleCheck(task)} className={`p-4 rounded border cursor-pointer flex gap-3 items-center ${checklistData[task] ? 'bg-green-900/30 border-green-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                      <span className="text-lg">{checklistData[task] ? '✅' : '⬜'}</span> <span className="text-lg font-bold">{task}</span>
                   </div>
                 ));
              })()}
            </div>

            <div className="p-6 border-t border-slate-700 bg-slate-900 rounded-b-2xl">
              <button onClick={submitBlock} className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold shadow-lg transition-transform active:scale-95">
                {activeModal === 'qc' ? 'APPROVE QC & FINISH' : 'MARK TASKS COMPLETE'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}