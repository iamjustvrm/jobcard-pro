"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// 📋 MASTER INVENTORY LIST (The Dispute Shield)
const INVENTORY_ITEMS = [
  "Spare Wheel", "Jack & Rod", "Tool Kit", "Stereo Faceplate", 
  "Mud Flaps", "Floor Mats", "God Idol / Perfume", "Manual / Service Book"
];

// 🚗 BODY PANELS (Visual Check)
const BODY_PANELS = ["Front Bumper", "Rear Bumper", "Bonnet", "Roof", "Left Doors", "Right Doors", "Tailgate", "Windshield"];

// 🚦 DASHBOARD LIGHTS
const WARNING_LIGHTS = ["Check Engine", "ABS", "Airbag", "Battery", "Oil Pressure", "Coolant Temp"];

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState('DASHBOARD'); 
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null); 
  
  // --- MASTER DATA STRUCTURE (V9: INTEGRATED) ---
  const [formData, setFormData] = useState({
    // 1. Header & Meta
    jobCardNo: '', 
    promisedDelivery: '',
    advisorName: 'Admin',
    serviceType: 'PMS',
    
    // 2. Customer & Billing
    customerName: '', customerPhone: '',
    billingName: '', billingAddress: '', gstin: '',
    
    // 3. Vehicle DNA
    vehicleNumber: '', make: '', model: '', variant: '', 
    color: '', fuelType: 'Petrol', year: '',
    vin: '', engineNo: '', keyNo: '', batteryId: '',
    odometer: '', 
    
    // 4. The Dispute Shield
    fuelLevel: '50',
    inventory: {}, 
    warningLights: {}, 
    tyreCondition: 'OK', 
    
    // 5. Body Inspection
    bodyDamages: {}, 
    
    // 6. Job Scope
    complaints: '', 
    instructions: '',
    tasks: { mechanical: [], electrical: [] },
    
    // System fields
    blocks: { mechanical: 'PENDING', electrical: 'PENDING', qc: 'PENDING' },
    expenses: [],
    status: 'PENDING'
  });

  const [newTaskInput, setNewTaskInput] = useState({ mech: '', elec: '' });
  const [newExpense, setNewExpense] = useState({ type: 'Fuel', amount: '', desc: '' });

  // LISTEN TO DB
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // --- HANDLERS ---
  const toggleInventory = (item) => {
    setFormData(prev => ({ ...prev, inventory: { ...prev.inventory, [item]: !prev.inventory[item] } }));
  };

  const toggleWarningLight = (light) => {
    setFormData(prev => ({ ...prev, warningLights: { ...prev.warningLights, [light]: !prev.warningLights[light] } }));
  };

  // FIXED FUNCTION HERE
  const toggleBodyDamage = (panel, type) => {
    // Get current damages array or empty array
    const damages = formData.bodyDamages[panel] || [];
    
    // Toggle logic
    const newDamages = damages.includes(type) 
      ? damages.filter(d => d !== type) 
      : [...damages, type];
    
    setFormData(prev => ({ ...prev, bodyDamages: { ...prev.bodyDamages, [panel]: newDamages } }));
  };

  const addTask = (type) => {
    const val = type === 'mech' ? newTaskInput.mech : newTaskInput.elec;
    if(!val) return;
    setFormData(prev => ({
      ...prev,
      tasks: { ...prev.tasks, [type === 'mech' ? 'mechanical' : 'electrical']: [...(type === 'mech' ? prev.tasks.mechanical : prev.tasks.electrical), val] }
    }));
    setNewTaskInput({ ...newTaskInput, [type]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.vehicleNumber) return;
    
    await addDoc(collection(db, "jobs"), { 
      ...formData, 
      createdAt: serverTimestamp(),
      detailedQC: {} 
    });
    
    alert("Job Card Created with Full Forensic Data!");
    setActiveTab('DASHBOARD');
    setFormData({ ...formData, vehicleNumber: '', complaints: '', odometer: '', bodyDamages: {}, inventory: {} });
  };

  const deleteJob = async (id) => { if(confirm("Delete?")) await deleteDoc(doc(db, "jobs", id)); };

  const addExpense = async () => {
    if(!selectedJobId || !newExpense.amount) return;
    const job = jobs.find(j => j.id === selectedJobId);
    const updatedExpenses = [...(job.expenses || []), { ...newExpense, id: Date.now() }];
    await updateDoc(doc(db, "jobs", selectedJobId), { expenses: updatedExpenses });
    setNewExpense({ type: 'Fuel', amount: '', desc: '' });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans pb-20">
      
      {/* NAVBAR */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-black text-blue-500">JOB<span className="text-white">CARD</span> <span className="text-xs text-slate-500">V9</span></h1>
          <div className="flex bg-slate-900 rounded-lg p-1">
             <button onClick={() => {setActiveTab('DASHBOARD'); setSelectedJobId(null)}} className={`px-3 md:px-4 py-1 rounded text-xs md:text-sm font-bold transition-all ${activeTab === 'DASHBOARD' ? 'bg-blue-600 shadow' : 'text-slate-400'}`}>📡 Fleet</button>
             <button onClick={() => setActiveTab('NEW_ENTRY')} className={`px-3 md:px-4 py-1 rounded text-xs md:text-sm font-bold transition-all ${activeTab === 'NEW_ENTRY' ? 'bg-green-600 shadow' : 'text-slate-400'}`}>➕ New Job</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* ================= VIEW 1: THE FORENSIC INTAKE FORM ================= */}
        {activeTab === 'NEW_ENTRY' && (
          <div className="max-w-5xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-6 border-b border-slate-700 flex justify-between items-center">
               <h2 className="text-xl font-bold text-green-400">New Vehicle Intake</h2>
               <div className="text-xs text-slate-500 font-mono">ID: {new Date().getTime().toString().slice(-6)}</div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              
              {/* SECTION 1: CUSTOMER & BILLING */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider border-b border-slate-700 pb-2">1. Customer Intelligence</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <input required placeholder="Customer Name" className="bg-slate-900 border border-slate-600 rounded p-3" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
                   <input required placeholder="Phone (WhatsApp)" className="bg-slate-900 border border-slate-600 rounded p-3" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <input placeholder="Billing Name (if diff)" className="bg-slate-900 border border-slate-600 rounded p-3 md:col-span-2" value={formData.billingName} onChange={e => setFormData({...formData, billingName: e.target.value})} />
                   <input placeholder="GSTIN (Optional)" className="bg-slate-900 border border-slate-600 rounded p-3" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})} />
                </div>
              </div>

              {/* SECTION 2: VEHICLE DNA */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider border-b border-slate-700 pb-2">2. Vehicle DNA</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <input required placeholder="REG NO (KA-01...)" className="bg-slate-900 border border-slate-600 rounded p-3 uppercase font-mono text-yellow-400 font-bold" value={formData.vehicleNumber} onChange={e => setFormData({...formData, vehicleNumber: e.target.value.toUpperCase()})} />
                   <input required placeholder="Model (e.g. Creta)" className="bg-slate-900 border border-slate-600 rounded p-3" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                   <input placeholder="Variant" className="bg-slate-900 border border-slate-600 rounded p-3" value={formData.variant} onChange={e => setFormData({...formData, variant: e.target.value})} />
                   <input required type="number" placeholder="Odometer (KM)" className="bg-slate-900 border border-slate-600 rounded p-3" value={formData.odometer} onChange={e => setFormData({...formData, odometer: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                   <input placeholder="VIN / Chassis" className="bg-slate-900 border border-slate-600 rounded p-2 uppercase" value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} />
                   <input placeholder="Engine No" className="bg-slate-900 border border-slate-600 rounded p-2 uppercase" value={formData.engineNo} onChange={e => setFormData({...formData, engineNo: e.target.value})} />
                   <input placeholder="Key Number" className="bg-slate-900 border border-slate-600 rounded p-2" value={formData.keyNo} onChange={e => setFormData({...formData, keyNo: e.target.value})} />
                   <input placeholder="Battery ID/Make" className="bg-slate-900 border border-slate-600 rounded p-2" value={formData.batteryId} onChange={e => setFormData({...formData, batteryId: e.target.value})} />
                </div>
              </div>

              {/* SECTION 3: THE DISPUTE SHIELD (INSPECTION) */}
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-600 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                   <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">3. Dispute Shield (Inspection)</h3>
                   <div className="text-xs text-slate-500">Forensic Record</div>
                </div>

                {/* 3.1 Fuel & Tyres */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">FUEL LEVEL</label>
                      <input type="range" min="0" max="100" step="25" className="w-full accent-yellow-500" value={formData.fuelLevel} onChange={e => setFormData({...formData, fuelLevel: e.target.value})} />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>E</span><span>25</span><span>50</span><span>75</span><span>F</span></div>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">TYRE CONDITION</label>
                      <div className="flex gap-2">
                         {['OK', 'WORN', 'CRITICAL'].map(status => (
                           <button key={status} type="button" onClick={() => setFormData({...formData, tyreCondition: status})}
                             className={`flex-1 py-2 rounded text-xs font-bold border ${formData.tyreCondition === status ? (status === 'OK' ? 'bg-green-600 border-green-500' : 'bg-red-600 border-red-500') : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                             {status}
                           </button>
                         ))}
                      </div>
                   </div>
                </div>

                {/* 3.2 Dashboard Lights */}
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-2 block">DASHBOARD WARNING LIGHTS (ON)</label>
                   <div className="flex flex-wrap gap-2">
                      {WARNING_LIGHTS.map(light => (
                        <button key={light} type="button" onClick={() => toggleWarningLight(light)}
                          className={`px-3 py-1 rounded-full text-xs border ${formData.warningLights[light] ? 'bg-red-900/50 border-red-500 text-red-400' : 'bg-slate-800 border-slate-600 text-slate-500'}`}>
                          {light}
                        </button>
                      ))}
                   </div>
                </div>

                {/* 3.3 Inventory Checklist */}
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-2 block">INVENTORY CHECKLIST</label>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {INVENTORY_ITEMS.map(item => (
                        <div key={item} onClick={() => toggleInventory(item)} 
                             className={`cursor-pointer p-2 rounded border flex items-center gap-2 transition-all ${formData.inventory[item] ? 'bg-blue-900/30 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                           <span className="text-sm">{formData.inventory[item] ? '✅' : '⬜'}</span>
                           <span className="text-[10px] font-bold uppercase">{item}</span>
                        </div>
                      ))}
                   </div>
                </div>

                {/* 3.4 Visual Body Inspection */}
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-2 block">BODY DAMAGE MAP (Tap to mark)</label>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {BODY_PANELS.map(panel => (
                        <div key={panel} className="bg-slate-800 p-3 rounded border border-slate-700">
                           <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">{panel}</div>
                           <div className="flex gap-1">
                              {['Scratch', 'Dent', 'Crack'].map(type => (
                                <button key={type} type="button" onClick={() => toggleBodyDamage(panel, type)}
                                  className={`flex-1 text-[9px] py-1 rounded border ${formData.bodyDamages[panel]?.includes(type) ? 'bg-red-600 text-white border-red-500' : 'bg-slate-900 text-slate-600 border-slate-700'}`}>
                                  {type[0]}
                                </button>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>
                   <p className="text-[10px] text-slate-500 mt-1">* S=Scratch, D=Dent, C=Crack</p>
                </div>
              </div>

              {/* SECTION 4: JOB SCOPE & TASKS */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider border-b border-slate-700 pb-2">4. Work Scope</h3>
                
                {/* Promise Date */}
                <div className="flex gap-4 items-center bg-slate-900 p-3 rounded border border-slate-600">
                   <label className="text-xs font-bold text-yellow-500">PROMISED DELIVERY:</label>
                   <input type="datetime-local" className="bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white" value={formData.promisedDelivery} onChange={e => setFormData({...formData, promisedDelivery: e.target.value})} />
                </div>

                <textarea required placeholder="Customer Voice (Verbatim Complaints)..." className="w-full bg-slate-900 border border-slate-600 rounded p-3 min-h-[100px]" value={formData.complaints} onChange={e => setFormData({...formData, complaints: e.target.value})} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="bg-slate-900 p-3 rounded border border-slate-700">
                      <div className="flex gap-2 mb-2">
                         <input placeholder="Add Mechanical Task..." className="flex-grow bg-slate-800 rounded p-2 text-xs" value={newTaskInput.mech} onChange={e => setNewTaskInput({...newTaskInput, mech: e.target.value})} />
                         <button type="button" onClick={() => addTask('mech')} className="bg-orange-600 px-3 rounded font-bold">+</button>
                      </div>
                      <div className="space-y-1">
                         {formData.tasks.mechanical.map((t, i) => <div key={i} className="text-xs bg-slate-800 p-1 px-2 rounded text-slate-300">{t}</div>)}
                      </div>
                   </div>
                   <div className="bg-slate-900 p-3 rounded border border-slate-700">
                      <div className="flex gap-2 mb-2">
                         <input placeholder="Add Electrical Task..." className="flex-grow bg-slate-800 rounded p-2 text-xs" value={newTaskInput.elec} onChange={e => setNewTaskInput({...newTaskInput, elec: e.target.value})} />
                         <button type="button" onClick={() => addTask('elec')} className="bg-yellow-600 px-3 rounded font-bold">+</button>
                      </div>
                      <div className="space-y-1">
                         {formData.tasks.electrical.map((t, i) => <div key={i} className="text-xs bg-slate-800 p-1 px-2 rounded text-slate-300">{t}</div>)}
                      </div>
                   </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="flex gap-4 pt-4 border-t border-slate-700">
                 <select className="flex-grow bg-slate-900 border border-slate-600 rounded p-3" value={formData.technicianName} onChange={e => setFormData({...formData, technicianName: e.target.value})}>
                    <option value="">Assign Technician...</option>
                    <option value="Raju Mechanic">Raju Mechanic</option>
                    <option value="John Doe">John Doe</option>
                 </select>
                 <button type="submit" className="bg-green-600 hover:bg-green-500 text-white px-8 rounded-xl font-bold shadow-lg transition-transform active:scale-95">CREATE JOB CARD</button>
              </div>

            </form>
          </div>
        )}

        {/* ================= VIEW 2: DASHBOARD (UNCHANGED BUT ROBUST) ================= */}
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {jobs.map((job) => (
                <div key={job.id} onClick={() => setSelectedJobId(job.id)} 
                  className={`cursor-pointer p-5 rounded-xl border transition-all ${selectedJobId === job.id ? 'bg-slate-700 border-blue-500 scale-[1.01]' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                   <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-black font-mono text-white">{job.vehicleNumber}</h3>
                        <p className="text-xs text-slate-400">{job.model} • {job.customerName}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${job.status === 'DONE' ? 'bg-green-500 text-black' : 'bg-blue-600 text-white'}`}>{job.status}</span>
                   </div>
                   <div className="flex gap-1 my-3 h-2">
                      <div className={`flex-1 rounded-l ${job.blocks?.mechanical === 'DONE' ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                      <div className={`flex-1 ${job.blocks?.electrical === 'DONE' ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                      <div className={`flex-1 rounded-r ${job.blocks?.qc === 'DONE' ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                   </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1 bg-slate-800 rounded-xl border border-slate-700 p-6 h-fit sticky top-24 max-h-[90vh] overflow-y-auto">
              {selectedJobId ? (() => {
                  const job = jobs.find(j => j.id === selectedJobId);
                  return (
                    <div className="space-y-6 animate-in fade-in">
                      <h2 className="text-2xl font-black border-b border-slate-700 pb-2">{job.vehicleNumber}</h2>
                      
                      {/* FORENSIC SUMMARY */}
                      <div className="bg-slate-900/50 p-4 rounded border border-slate-700 text-xs space-y-2">
                         <div className="flex justify-between"><span className="text-slate-500">Fuel</span><span className="text-yellow-400 font-bold">{job.fuelLevel}%</span></div>
                         <div className="flex justify-between"><span className="text-slate-500">Tyres</span><span className={`font-bold ${job.tyreCondition === 'OK' ? 'text-green-400' : 'text-red-400'}`}>{job.tyreCondition}</span></div>
                         <div className="flex justify-between"><span className="text-slate-500">Damages</span><span className="text-red-400">{Object.keys(job.bodyDamages || {}).length} Panels</span></div>
                         <div className="flex justify-between"><span className="text-slate-500">Inventory</span><span className="text-blue-400">{Object.values(job.inventory || {}).filter(Boolean).length} Items</span></div>
                      </div>

                      {/* EXPENSES */}
                      <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                        <h3 className="text-xs font-bold text-yellow-500 uppercase mb-3">💰 Expenses</h3>
                        <div className="space-y-2 mb-4">
                          {job.expenses?.map((exp) => (
                            <div key={exp.id} className="flex justify-between text-sm border-b border-slate-700/50 pb-1">
                               <span>{exp.type}</span><span className="font-mono">₹{exp.amount}</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                           <select className="bg-slate-800 rounded p-2 text-xs" value={newExpense.type} onChange={(e) => setNewExpense({...newExpense, type: e.target.value})}>
                              <option>Fuel</option><option>Lathe</option><option>Transport</option><option>Spares</option>
                           </select>
                           <input type="number" placeholder="₹" className="bg-slate-800 rounded p-2 text-xs" 
                             value={newExpense.amount} onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})} />
                        </div>
                        <button onClick={addExpense} className="w-full bg-yellow-600 hover:bg-yellow-500 text-xs font-bold py-2 rounded">ADD EXPENSE</button>
                      </div>

                      <div className="flex gap-2">
                         <Link href={`/bill/${job.id}`} className="flex-1 bg-blue-600 text-center py-3 rounded font-bold text-sm">Invoice</Link>
                         <button onClick={() => deleteJob(job.id)} className="px-4 bg-red-900/50 text-red-400 rounded">🗑️</button>
                      </div>
                    </div>
                  );
              })() : <div className="text-center text-slate-500 py-10">Select Job</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}