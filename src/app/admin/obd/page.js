"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import { db, auth } from '../../../firebase';

// 🧠 THE MASTER SEED DATA (DEEP ANALYSIS)
// This simulates an "Industry Best" Library
const MASTER_OBD_SEED = [
  {
    code: "P0300",
    title: "Random / Multiple Cylinder Misfire",
    severity: "CRITICAL",
    symptoms: ["Check Engine Light Flashing", "Rough Idle", "Hard Start", "Lack of Power"],
    diagnostic_steps: ["Inspect Spark Plugs for wear/fouling", "Test Ignition Coils (Swap method)", "Check Fuel Injector pulse", "Compression Test"],
    potential_parts: ["Spark Plugs", "Ignition Coils", "Spark Plug Wires", "Fuel Injector"]
  },
  {
    code: "P0171",
    title: "System Too Lean (Bank 1)",
    severity: "MEDIUM",
    symptoms: ["Hesitation on acceleration", "Poor Fuel Economy", "Rough Idle"],
    diagnostic_steps: ["Smoke Test for Vacuum Leaks", "Clean/Test MAF Sensor", "Check Fuel Pressure", "Inspect O2 Sensor Data"],
    potential_parts: ["MAF Sensor", "PCV Valve", "Vacuum Hoses", "O2 Sensor (Upstream)"]
  },
  {
    code: "P0420",
    title: "Catalyst System Efficiency Below Threshold",
    severity: "LOW",
    symptoms: ["Check Engine Light On", "Rotten Egg Smell (Sulfur)", "Slight power loss"],
    diagnostic_steps: ["Check for Exhaust Leaks", "Compare Upstream vs Downstream O2 Sensors", "Temperature check on Cat Converter"],
    potential_parts: ["Catalytic Converter", "O2 Sensor (Downstream)", "Exhaust Gasket"]
  },
  {
    code: "P0113",
    title: "Intake Air Temperature (IAT) Circuit High",
    severity: "MEDIUM",
    symptoms: ["Hard cold start", "Poor Fuel Economy", "ECM goes into Safe Mode"],
    diagnostic_steps: ["Inspect IAT Sensor wiring", "Check Sensor Resistance (Ohms)", "Check 5V Reference at connector"],
    potential_parts: ["IAT Sensor", "Wiring Harness"]
  },
  {
    code: "P0500",
    title: "Vehicle Speed Sensor (VSS) Malfunction",
    severity: "MEDIUM",
    symptoms: ["Speedometer not working", "Erratic shifting (Automatic)", "ABS Light On"],
    diagnostic_steps: ["Inspect VSS Gear/Magnet", "Check Wiring to ECM", "Scan ABS Module for wheel speed"],
    potential_parts: ["Vehicle Speed Sensor", "ABS Sensor"]
  },
  {
    code: "P0700",
    title: "Transmission Control System (TCS) Malfunction",
    severity: "CRITICAL",
    symptoms: ["Transmission stuck in gear", "Limp Mode", "Check Engine Light"],
    diagnostic_steps: ["Scan TCM for specific sub-codes", "Check Transmission Fluid Level/Condition", "Inspect Solenoid Wiring"],
    potential_parts: ["Transmission Solenoid", "TCM Unit", "Trans Fluid"]
  },
  {
    code: "P0087",
    title: "Fuel Rail/System Pressure - Too Low",
    severity: "CRITICAL",
    symptoms: ["Engine Stalls", "Limp Mode", "No Start"],
    diagnostic_steps: ["Check Fuel Filter for blockage", "Test High Pressure Pump (Diesel)", "Check In-tank Fuel Pump"],
    potential_parts: ["Fuel Filter", "High Pressure Pump", "Fuel Pressure Regulator"]
  }
  // You can extend this list endlessly...
];

export default function OBDLibrary() {
  const router = useRouter(); 
  const [loading, setLoading] = useState(true); 
  const [obdList, setObdList] = useState([]);
  const [search, setSearch] = useState('');
  
  // FORM STATE
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
     code: '', title: '', severity: 'MEDIUM', 
     symptoms: '', diagnostic_steps: '', potential_parts: ''
  });

  // 1. SECURITY
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push('/');
      else setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. LIVE DATA SYNC
  useEffect(() => {
    const q = query(collection(db, "obd_library"), orderBy("code", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setObdList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ⚡ SEED FUNCTION (One-Click Setup)
  const seedDatabase = async () => {
    if(!confirm("⚠️ This will inject master OBD codes into your database. Continue?")) return;
    try {
        const batch = writeBatch(db);
        MASTER_OBD_SEED.forEach((item) => {
            // Check if code exists in current list to avoid duplicates (Client side check for speed)
            if(!obdList.find(x => x.code === item.code)) {
                const docRef = doc(collection(db, "obd_library"));
                batch.set(docRef, item);
            }
        });
        await batch.commit();
        alert("✅ Knowledge Injection Complete!");
    } catch(e) {
        alert("Error seeding: " + e.message);
    }
  };

  const handleDelete = async (id) => {
    if(confirm("Delete this Knowledge Record?")) await deleteDoc(doc(db, "obd_library", id));
  };

  const handleSave = async () => {
      if(!formData.code || !formData.title) return alert("Code and Title required");
      
      // Convert comma strings to arrays for the "Smart" logic
      const payload = {
          code: formData.code.toUpperCase(),
          title: formData.title,
          severity: formData.severity,
          symptoms: formData.symptoms.split(',').map(s => s.trim()).filter(s => s),
          diagnostic_steps: formData.diagnostic_steps.split(',').map(s => s.trim()).filter(s => s),
          potential_parts: formData.potential_parts.split(',').map(s => s.trim()).filter(s => s),
      };

      await addDoc(collection(db, "obd_library"), payload);
      setIsFormOpen(false);
      setFormData({ code: '', title: '', severity: 'MEDIUM', symptoms: '', diagnostic_steps: '', potential_parts: '' });
  };

  // 🔍 SEARCH FILTER
  const filteredList = obdList.filter(item => 
    item.code.includes(search.toUpperCase()) || 
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-500 font-bold">Accessing Mainframe...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6">
      
      {/* HEADER */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
            <h1 className="text-3xl font-black text-blue-500">OBD<span className="text-white">MASTER</span> <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">INTELLIGENCE</span></h1>
            <p className="text-slate-400 text-sm mt-1">Diagnostic Trouble Code (DTC) Knowledge Base</p>
        </div>
        <div className="flex gap-4">
            <button onClick={() => router.push('/admin')} className="text-slate-400 hover:text-white font-bold text-sm">⬅ Back to Admin</button>
            <button onClick={seedDatabase} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded font-bold shadow-lg animate-pulse">⚡ INJECT MASTER DATA</button>
            <button onClick={() => setIsFormOpen(true)} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-bold shadow-lg">+ ADD NEW CODE</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: SEARCH & LIST */}
        <div className="lg:col-span-1 space-y-4">
            <input 
                placeholder="🔍 Search Code (e.g. P0300)..." 
                className="w-full bg-slate-800 border border-slate-600 p-4 rounded-xl text-lg font-mono uppercase text-yellow-400 focus:border-blue-500 outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                {filteredList.map(obd => (
                    <div key={obd.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-blue-500 group relative">
                        <div className="flex justify-between items-start">
                            <h3 className="text-2xl font-black font-mono text-yellow-400">{obd.code}</h3>
                            <button onClick={() => handleDelete(obd.id)} className="text-red-500 opacity-0 group-hover:opacity-100">×</button>
                        </div>
                        <p className="text-sm font-bold text-white leading-tight">{obd.title}</p>
                        <div className="mt-2 flex gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${obd.severity === 'CRITICAL' ? 'bg-red-600' : obd.severity === 'MEDIUM' ? 'bg-orange-500 text-black' : 'bg-green-600'}`}>{obd.severity}</span>
                            <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">{obd.diagnostic_steps?.length || 0} Steps</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* RIGHT: PREVIEW & ENTRY */}
        <div className="lg:col-span-2">
            {isFormOpen ? (
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-600 shadow-2xl">
                    <h2 className="text-xl font-bold mb-6 text-green-400">Add New Intelligence Record</h2>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-slate-500">DTC CODE</label>
                            <input className="w-full bg-slate-900 border border-slate-600 p-3 rounded text-yellow-400 font-mono uppercase text-xl" placeholder="PXXXX" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-slate-500">SEVERITY</label>
                            <select className="w-full bg-slate-900 border border-slate-600 p-3 rounded" value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})}>
                                <option>LOW</option><option>MEDIUM</option><option>CRITICAL</option>
                            </select>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="text-xs font-bold text-slate-500">TECHNICAL TITLE</label>
                        <input className="w-full bg-slate-900 border border-slate-600 p-3 rounded" placeholder="e.g. Cyl 1 Misfire" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-blue-400">SYMPTOMS (Comma Separated)</label>
                            <textarea className="w-full bg-slate-900 border border-slate-600 p-3 rounded text-sm" placeholder="Rough idle, Low power..." value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-green-400">DIAGNOSTIC STEPS (The Checklist)</label>
                            <textarea className="w-full bg-slate-900 border border-slate-600 p-3 rounded text-sm" placeholder="Check Plugs, Swap Coils..." value={formData.diagnostic_steps} onChange={e => setFormData({...formData, diagnostic_steps: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-orange-400">LIKELY PARTS (For Estimate)</label>
                            <textarea className="w-full bg-slate-900 border border-slate-600 p-3 rounded text-sm" placeholder="Spark Plug, Ignition Coil..." value={formData.potential_parts} onChange={e => setFormData({...formData, potential_parts: e.target.value})} />
                        </div>
                    </div>

                    <div className="flex gap-4 mt-6">
                        <button onClick={() => setIsFormOpen(false)} className="flex-1 bg-slate-700 py-3 rounded font-bold">CANCEL</button>
                        <button onClick={handleSave} className="flex-1 bg-green-600 py-3 rounded font-bold">SAVE TO LIBRARY</button>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-800/50 p-10 rounded-2xl border border-dashed border-slate-700 flex flex-col items-center justify-center h-full text-slate-500">
                    <div className="text-6xl mb-4">🧠</div>
                    <h2 className="text-xl font-bold">Select a Code or Add New</h2>
                    <p className="max-w-md text-center mt-2">This library drives the AI logic in the Supervisor Dashboard. Adding codes here makes the entire system smarter.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}