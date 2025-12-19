"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore'; 
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import { db, auth } from '../../firebase';

// 📋 MASTER DATA CONSTANTS (ORIGINAL)
const INVENTORY_ITEMS = ["Spare Wheel", "Jack & Rod", "Tool Kit", "Stereo Faceplate", "Mud Flaps", "Floor Mats", "God Idol / Perfume", "Manual / Service Book"];
const BODY_PANELS = ["Front Bumper", "Rear Bumper", "Bonnet", "Roof", "Left Doors", "Right Doors", "Tailgate", "Windshield"];
const WARNING_LIGHTS = ["Check Engine", "ABS", "Airbag", "Battery", "Oil Pressure", "Coolant Temp"];
const FUEL_TYPES = ["Petrol", "Diesel", "Electric (EV)", "CNG / Hybrid"];
const BODY_TYPES = ["Hatchback", "Sedan", "SUV", "Luxury", "Commercial"]; 
const SERVICE_TYPES = ["PMS (Periodic Service)", "Running Repair", "Accidental", "Breakdown", "Warranty Check"];
const TECHNICIANS = ["Raju Mechanic", "John Doe", "Electrical Specialist"];

// 🧠 AI RULES ENGINE
const AI_RULES = [
  { keywords: ["brake", "noise", "grinding", "squeak", "pad", "disc"], tasks: ["Inspect Brake Pads (Front/Rear)", "Check Disc Rotor condition", "Bleed Brake Fluid"] },
  { keywords: ["ac", "cooling", "hot", "smell", "compressor"], tasks: ["Check AC Gas Pressure", "Inspect Cabin Filter", "Check Compressor Clutch"] },
  { keywords: ["engine", "oil", "leak", "smoke", "sump"], tasks: ["Check Oil Level & Quality", "Inspect Tappet Cover Packing", "Check for Sump Leaks"] },
  { keywords: ["vibration", "wobble", "alignment", "steering"], tasks: ["Check Wheel Balancing", "Inspect Steering Rack", "Check Suspension Bushes"] },
  { keywords: ["start", "battery", "cranking", "dim"], tasks: ["Battery Voltage Test", "Alternator Charging Check", "Starter Motor Current Draw"] },
  { keywords: ["service", "general", "pms", "oil change"], tasks: ["Replace Engine Oil", "Replace Oil Filter", "Clean Air Filter", "Top-up Fluids", "General Wash"] }
];

export default function SupervisorDashboard() {
  const router = useRouter(); 
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true); 

  const [activeTab, setActiveTab] = useState('DASHBOARD'); 
  const [jobs, setJobs] = useState([]);
  const [inventoryDB, setInventoryDB] = useState([]); 
  const [selectedJobId, setSelectedJobId] = useState(null); 
  const [isEditing, setIsEditing] = useState(false); 
  
  // --- MASTER STATE ---
  const [formData, setFormData] = useState({
    customerName: '', customerPhone: '', billingName: '', gstin: '',
    regNo: '', make: '', model: '', variant: '', bodyType: 'Hatchback', 
    fuelType: 'Petrol', serviceType: 'PMS', 
    odometer: '', vin: '', engineNo: '', keyNo: '', batteryId: '',
    fuelLevel: '50', tyreCondition: 'OK',
    inventory: {}, warningLights: {}, bodyDamages: {}, 
    supervisorObs: '', customerImages: '', voiceNoteLink: '', obdScanReport: '', testDriveReport: '', 
    promisedDelivery: '', complaints: '', technicianName: '', 
    blocks: [
      { name: 'Mechanical', status: 'PENDING', steps: [] },
      { name: 'Electrical', status: 'PENDING', steps: [] },
      { name: 'QC', status: 'PENDING', steps: ['Final Road Test', 'OBD Scan'] }
    ],
    status: 'ESTIMATE',
    expenses: [], parts: [], labor: []
  });

  const [newTaskInput, setNewTaskInput] = useState({ mech: '', elec: '' });
  const [newItem, setNewItem] = useState({ category: 'PART', desc: '', qty: 1, price: 0 });

  // 🔒 SECURITY LAYER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === 'admin' || userData.role === 'supervisor') {
              setUser(currentUser);
              setLoading(false);
              return;
            }
          }
          if (currentUser.email.includes('admin')) { setUser(currentUser); setLoading(false); return; }
        } catch (e) { console.error("Auth Error", e); }
      }
      router.push('/');
    });
    return () => unsubscribe();
  }, [router]);

  // DB SYNC
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setInventoryDB(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  // --- HANDLERS (ORIGINAL V30 + NEW APPROVALS) ---
  const updateForm = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };
  const toggleInventory = (item) => setFormData(p => ({ ...p, inventory: { ...p.inventory, [item]: !p.inventory[item] } }));
  const toggleWarningLight = (light) => setFormData(p => ({ ...p, warningLights: { ...p.warningLights, [light]: !p.warningLights[light] } }));
  const toggleBodyDamage = (panel, type) => {
    const damages = formData.bodyDamages[panel] || [];
    const newDamages = damages.includes(type) ? damages.filter(d => d !== type) : [...damages, type];
    setFormData(p => ({ ...p, bodyDamages: { ...p.bodyDamages, [panel]: newDamages } }));
  };

  const generateAIWorkPlan = () => {
    const inputText = (formData.complaints + " " + formData.supervisorObs + " " + formData.obdScanReport).toLowerCase();
    const suggestedTasks = [];
    AI_RULES.forEach(rule => {
      if (rule.keywords.some(k => inputText.includes(k))) suggestedTasks.push(...rule.tasks);
    });
    if (suggestedTasks.length === 0) { alert("ℹ️ AI: No specific patterns matched."); return; }
    const updatedBlocks = [...formData.blocks];
    const uniqueTasks = [...new Set([...updatedBlocks[0].steps, ...suggestedTasks])];
    updatedBlocks[0].steps = uniqueTasks;
    setFormData(prev => ({ ...prev, blocks: updatedBlocks }));
    alert(`✨ AI predicted ${suggestedTasks.length} tasks!`);
  };

  const addTask = (type) => {
    const val = type === 'mech' ? newTaskInput.mech : newTaskInput.elec;
    if(!val) return;
    const targetBlockIndex = type === 'mech' ? 0 : 1; 
    const updatedBlocks = [...formData.blocks];
    updatedBlocks[targetBlockIndex].steps.push(val);
    setFormData(p => ({ ...p, blocks: updatedBlocks }));
    setNewTaskInput({ ...newTaskInput, [type]: '' });
  };

  const addLineItem = async () => {
    if(!selectedJobId) return;
    const job = jobs.find(j => j.id === selectedJobId);
    const itemEntry = { id: Date.now(), ...newItem, total: newItem.qty * newItem.price };
    const field = newItem.category === 'PART' ? 'parts' : 'labor';
    await updateDoc(doc(db, "jobs", selectedJobId), { [field]: [...(job[field] || []), itemEntry] });
    setNewItem({ category: 'PART', desc: '', qty: 1, price: 0 });
  };

  const getFilteredInventory = (job) => {
    if (!job) return [];
    return inventoryDB.filter(item => {
      const tags = item.tags || ['Universal'];
      return (tags.includes('Universal') || tags.includes(job.fuelType) || tags.includes(job.bodyType || 'Hatchback'));
    });
  };

  const handleMasterItemSelect = (e) => {
    const selectedName = e.target.value;
    const foundItem = inventoryDB.find(item => item.name === selectedName);
    if (foundItem) {
      setNewItem({ category: foundItem.category, desc: foundItem.name, qty: 1, price: foundItem.price });
    }
  };

  const startEdit = (job) => {
    setFormData({ ...job }); 
    setIsEditing(true);
    setSelectedJobId(job.id); 
    setActiveTab('NEW_ENTRY'); 
    window.scrollTo(0, 0); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.regNo) { alert("⚠️ Registration Number is Missing!"); return; }
    if(!formData.technicianName) { alert("⚠️ You MUST assign a Technician!"); return; }
    const payload = { ...formData, vehicleNumber: formData.regNo, technicianName: formData.technicianName, createdAt: isEditing ? formData.createdAt : serverTimestamp() };
    try {
      if(isEditing) {
         await updateDoc(doc(db, "jobs", selectedJobId), payload);
         alert(`✅ Job ${formData.regNo} Updated Successfully!`);
         setIsEditing(false); 
      } else {
         await addDoc(collection(db, "jobs"), payload);
         alert(`✅ Job Created & Assigned to ${formData.technicianName}`);
      }
      setActiveTab('DASHBOARD');
      setFormData({ customerName: '', customerPhone: '', billingName: '', gstin: '', regNo: '', make: '', model: '', variant: '', bodyType: 'Hatchback', fuelType: 'Petrol', serviceType: 'PMS', odometer: '', vin: '', engineNo: '', keyNo: '', batteryId: '', fuelLevel: '50', tyreCondition: 'OK', inventory: {}, warningLights: {}, bodyDamages: {}, supervisorObs: '', customerImages: '', voiceNoteLink: '', obdScanReport: '', testDriveReport: '', promisedDelivery: '', complaints: '', technicianName: '', blocks: [ { name: 'Mechanical', status: 'PENDING', steps: [] }, { name: 'Electrical', status: 'PENDING', steps: [] }, { name: 'QC', status: 'PENDING', steps: ['Final Road Test', 'OBD Scan'] } ], status: 'ESTIMATE', expenses: [], parts: [], labor: [] });
      setIsEditing(false);
    } catch (err) { alert("Error: " + err.message); }
  };

  const deleteJob = async (id) => { if(confirm("Delete?")) await deleteDoc(doc(db, "jobs", id)); };

  const sendWhatsApp = (job) => {
    const total = (job.parts?.reduce((a,b)=>a+b.total,0)||0) + (job.labor?.reduce((a,b)=>a+b.total,0)||0) + (job.expenses?.reduce((a,b)=>a+Number(b.amount),0)||0);
    const damageCount = Object.keys(job.bodyDamages||{}).length;
    const message = `*🚗 JobCard Pro - Service Estimate*\n*Vehicle:* ${job.model} (${job.regNo})\n*Customer:* ${job.customerName}\n\n*🔎 PRE-SERVICE INSPECTION:* \n• Tech Obs: ${job.supervisorObs || 'Standard Check'}\n• Fuel: ${job.fuelLevel}% | Tyres: ${job.tyreCondition}\n• Damages: ${damageCount} Panels Marked\n• Photos: ${job.customerImages || 'Not Attached'}\n\n*💰 ESTIMATE:*\n• Parts: ₹${job.parts?.reduce((a,b)=>a+b.total,0)||0}\n• Labor: ₹${job.labor?.reduce((a,b)=>a+b.total,0)||0}\n*TOTAL: ₹${total}*\n\nReply APPROVE to start work.`;
    const cleanPhone = job.customerPhone.replace(/\D/g, '').slice(-10); 
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const printJobCard = () => { window.print(); };

  // 🆕 NEW: APPROVE REQUEST HANDLER
  const approveRequest = async (job, request) => {
    // 1. Mark request as APPROVED
    const updatedRequests = job.partRequests.map(r => r.id === request.id ? { ...r, status: 'APPROVED' } : r);
    
    // 2. Add to actual Parts list (find price from DB)
    const masterItem = inventoryDB.find(i => i.name === request.name);
    const price = masterItem ? masterItem.price : 0;
    
    const newPart = {
       id: Date.now(),
       category: 'PART',
       desc: request.name,
       qty: 1,
       price: price,
       total: price
    };

    await updateDoc(doc(db, "jobs", job.id), {
      partRequests: updatedRequests,
      parts: [...(job.parts || []), newPart],
      status: 'WORK_IN_PROGRESS'
    });
    alert(`✅ Request Approved: ${request.name}`);
  };

  // 🆕 NEW: ASK CUSTOMER
  const askCustomerApproval = (job, requestName) => {
    const msg = `*⚠️ ADDITIONAL APPROVAL NEEDED*\n*Vehicle:* ${job.regNo}\n\nTechnician found issue with: *${requestName}*\n\nPlease reply APPROVE to proceed.`;
    window.open(`https://wa.me/91${job.customerPhone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-500 font-bold animate-pulse">🔒 Verifying Access...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans pb-20 print:bg-white print:text-black">
      
      {/* NAVBAR */}
      <div className="print:hidden bg-slate-800 border-b border-slate-700 sticky top-0 z-50 shadow-xl p-4 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-black text-blue-500">JOB<span className="text-white">CARD</span> <span className="text-xs text-slate-500">V34 FULL</span></h1>
        <div className="flex gap-4 items-center">
           <div className="flex bg-slate-900 rounded-lg p-1">
              <button onClick={() => {setActiveTab('DASHBOARD'); setSelectedJobId(null); setIsEditing(false)}} className={`px-4 py-1 rounded text-xs md:text-sm font-bold transition-all ${activeTab === 'DASHBOARD' ? 'bg-blue-600 shadow' : 'text-slate-400'}`}>📡 Fleet</button>
              <button onClick={() => {setActiveTab('NEW_ENTRY'); setIsEditing(false)}} className={`px-4 py-1 rounded text-xs md:text-sm font-bold transition-all ${activeTab === 'NEW_ENTRY' ? 'bg-green-600 shadow' : 'text-slate-400'}`}>➕ New Job</button>
           </div>
           <button onClick={handleLogout} className="bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded border border-red-600/30 text-xs font-bold transition-all">🔓 LOGOUT</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 print:p-0 print:max-w-none">
        
        {/* ================= VIEW 1: INTAKE FORM (FULLY RESTORED) ================= */}
        <div className="print:hidden">
        {activeTab === 'NEW_ENTRY' && (
          <div className="max-w-5xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className={`p-6 border-b border-slate-700 flex justify-between items-center ${isEditing ? 'bg-blue-900' : 'bg-slate-900'}`}>
               <h2 className="text-xl font-bold text-white">{isEditing ? '✏️ EDITING VEHICLE ENTRY' : 'New Vehicle Intake'}</h2>
               <div className="text-xs text-slate-400 font-mono">{isEditing ? `ID: ${selectedJobId.slice(-6)}` : `ID: ${new Date().getTime().toString().slice(-6)}`}</div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              {/* 1. CUSTOMER */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider border-b border-slate-700 pb-2">1. Customer Intelligence</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <input required placeholder="Customer Name" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.customerName} onChange={e => updateForm('customerName', e.target.value)} />
                   <input required placeholder="Phone (WhatsApp)" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.customerPhone} onChange={e => updateForm('customerPhone', e.target.value)} />
                   <input placeholder="Billing Name (if diff)" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.billingName} onChange={e => updateForm('billingName', e.target.value)} />
                   <input placeholder="GSTIN" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.gstin} onChange={e => updateForm('gstin', e.target.value)} />
                </div>
              </div>
              {/* 2. VEHICLE */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider border-b border-slate-700 pb-2">2. Vehicle DNA</h3>
                <div className="grid grid-cols-2 gap-4"><input required placeholder="REG NO" className="bg-slate-900 border border-slate-600 rounded-lg p-4 uppercase font-bold text-yellow-400" value={formData.regNo} onChange={e => updateForm('regNo', e.target.value.toUpperCase())} /><input required placeholder="Model" className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.model} onChange={e => updateForm('model', e.target.value)} /></div>
                
                {/* BODY TYPE SELECTOR */}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-[10px] text-blue-400 font-bold ml-1">BODY TYPE (For Pricing)</label>
                     <select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.bodyType} onChange={e => updateForm('bodyType', e.target.value)}>{BODY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                   </div>
                   <div>
                     <label className="text-[10px] text-blue-400 font-bold ml-1">FUEL TYPE</label>
                     <select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.fuelType} onChange={e => updateForm('fuelType', e.target.value)}>{FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4"><input placeholder="Variant" className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.variant} onChange={e => updateForm('variant', e.target.value)} /><input required type="number" placeholder="Odometer" className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.odometer} onChange={e => updateForm('odometer', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4"><input placeholder="VIN" className="bg-slate-900 border border-slate-600 rounded-lg p-4 uppercase" value={formData.vin} onChange={e => updateForm('vin', e.target.value)} /><input placeholder="Engine No" className="bg-slate-900 border border-slate-600 rounded-lg p-4 uppercase" value={formData.engineNo} onChange={e => updateForm('engineNo', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4"><select className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.serviceType} onChange={e => updateForm('serviceType', e.target.value)}>{SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              {/* 3. DISPUTE SHIELD */}
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-600 space-y-8">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2"><h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">3. Dispute Shield</h3></div>
                <div><label className="text-xs font-bold text-slate-500 mb-4 block">FUEL LEVEL</label><input type="range" min="0" max="100" step="25" className="w-full h-2 bg-slate-700 rounded-lg accent-yellow-400" value={formData.fuelLevel} onChange={e => updateForm('fuelLevel', e.target.value)} /><div className="flex justify-between text-xs text-slate-400 mt-2 font-mono"><span>E</span><span>25</span><span>50</span><span>75</span><span>F</span></div></div>
                <div><label className="text-xs font-bold text-slate-500 mb-2 block">TYRE CONDITION</label><div className="flex gap-4">{['OK', 'WORN', 'CRITICAL'].map(status => <button key={status} type="button" onClick={() => setFormData({...formData, tyreCondition: status})} className={`flex-1 py-3 rounded-lg text-xs font-bold border-2 transition-all ${formData.tyreCondition === status ? (status === 'OK' ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white') : 'bg-slate-800 border-slate-600 text-slate-400'}`}>{status}</button>)}</div></div>
                <div><label className="text-xs font-bold text-slate-500 mb-2 block">WARNING LIGHTS</label><div className="flex flex-wrap gap-2">{WARNING_LIGHTS.map(light => <button key={light} type="button" onClick={() => toggleWarningLight(light)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${formData.warningLights[light] ? 'bg-red-900/80 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-slate-800 border-slate-600 text-slate-500'}`}>{light}</button>)}</div></div>
                <div className="grid grid-cols-2 gap-3">{INVENTORY_ITEMS.map(item => <div key={item} onClick={() => toggleInventory(item)} className={`cursor-pointer p-4 rounded-lg border-2 flex items-center justify-between transition-all ${formData.inventory[item] ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-800 border-slate-700'}`}><span className={`text-xs font-bold uppercase ${formData.inventory[item] ? 'text-blue-300' : 'text-slate-500'}`}>{item}</span>{formData.inventory[item] && <span className="text-blue-500">✓</span>}</div>)}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{BODY_PANELS.map(panel => <div key={panel} className="bg-slate-800 p-2 rounded border border-slate-700"><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{panel}</div><div className="flex gap-1">{['S', 'D', 'C'].map(code => {const type = code === 'S' ? 'Scratch' : code === 'D' ? 'Dent' : 'Crack'; return (<button key={type} type="button" onClick={() => toggleBodyDamage(panel, type)} className={`flex-1 text-[9px] py-1 rounded border ${formData.bodyDamages[panel]?.includes(type) ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-600'}`}>{code}</button>);})}</div></div>)}</div>
              </div>
              {/* 4. INSPECTION & MEDIA */}
              <div className="space-y-4 pt-4 border-t border-slate-700">
                 <h3 className="text-xl font-black text-white bg-blue-600 p-3 rounded-lg text-center shadow-lg">📸 SUPERVISOR INSPECTION & PHOTOS</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-xs font-bold text-blue-400 uppercase">PRE-SERVICE INSPECTION REPORT</label><textarea placeholder="Type technical observations..." className="w-full bg-slate-900 border-2 border-blue-500/50 rounded-xl p-4 h-32 text-sm" value={formData.supervisorObs} onChange={e => updateForm('supervisorObs', e.target.value)} /></div>
                    <div className="space-y-4">
                       <div><label className="text-xs font-bold text-blue-400 uppercase">PHOTOS LINK</label><input placeholder="Google Photos Link..." className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-sm" value={formData.customerImages} onChange={e => updateForm('customerImages', e.target.value)} /></div>
                       <div><label className="text-xs font-bold text-blue-400 uppercase">OBD SCAN</label><input placeholder="Codes..." className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-sm font-mono text-yellow-400" value={formData.obdScanReport} onChange={e => updateForm('obdScanReport', e.target.value)} /></div>
                    </div>
                 </div>
              </div>
              {/* 5. WORK SCOPE & AI */}
              <div className="space-y-4 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">5. Work Scope & AI</h3>
                <textarea required placeholder="Customer Complaints..." className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 h-20 text-xs" value={formData.complaints} onChange={e => updateForm('complaints', e.target.value)} />
                <button type="button" onClick={generateAIWorkPlan} className="w-full bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-600 hover:to-blue-600 text-white p-3 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2">✨ CLICK TO AUTO-GENERATE TASKS (AI)</button>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center mb-2"><span className="font-bold text-xs text-slate-400 uppercase">Mechanical Tasks</span></div>
                  <div className="flex gap-2 mb-2"><input placeholder="Add Manual Task..." className="flex-grow bg-slate-800 rounded p-2 text-xs" value={newTaskInput.mech} onChange={e => setNewTaskInput({...newTaskInput, mech: e.target.value})} /><button type="button" onClick={() => addTask('mech')} className="bg-orange-600 px-3 rounded font-bold text-xs">+</button></div>
                  <ul className="space-y-1">{formData.blocks[0].steps.map((t, i) => <li key={i} className="text-xs bg-slate-800 p-2 rounded text-green-300 border border-slate-700">• {t}</li>)}</ul>
                </div>
              </div>
              {/* FOOTER */}
              <div className="pt-6 border-t border-slate-700 bg-slate-900 sticky bottom-0">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-yellow-500 uppercase">Assign Technician: {formData.technicianName ? `✅ ${formData.technicianName}` : '❌ NONE'}</label>
                    <div className="flex gap-4">
                       <select required className="flex-grow bg-slate-900 border border-slate-600 rounded-lg p-4 font-bold text-white focus:border-green-500" value={formData.technicianName} onChange={e => updateForm('technicianName', e.target.value)}><option value="">-- Select Technician --</option>{TECHNICIANS.map(tech => <option key={tech} value={tech}>{tech}</option>)}</select>
                       <button type="submit" className={`w-1/3 text-white rounded-xl font-bold text-lg shadow-lg ${isEditing ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}>{isEditing ? '🔄 UPDATE JOB' : 'CREATE JOB'}</button>
                    </div>
                 </div>
              </div>
            </form>
          </div>
        )}
        </div>

        {/* ================= VIEW 2: DASHBOARD (WITH NOTIFICATIONS) ================= */}
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            <div className="lg:col-span-2 space-y-4">
              {jobs.map((job) => {
                const hasPendingRequests = job.partRequests?.some(r => r.status === 'PENDING');
                return (
                <div key={job.id} onClick={() => setSelectedJobId(job.id)} className={`cursor-pointer p-5 rounded-xl border transition-all ${selectedJobId === job.id ? 'bg-slate-700 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                   <div className="flex justify-between items-start mb-2">
                      <div><h3 className="text-xl font-black font-mono text-white">{job.regNo || job.vehicleNumber}</h3><p className="text-xs text-slate-400">{job.model}</p></div>
                      <div className="text-right">
                         {hasPendingRequests ? 
                            <span className="block text-[10px] bg-red-600 text-white px-2 py-1 rounded mb-1 animate-pulse">🔔 PART REQUEST</span> :
                            <span className="block text-[10px] bg-blue-900 text-blue-300 px-2 py-1 rounded mb-1">{job.serviceType}</span>
                         }
                         <span className="text-[10px] text-yellow-500 font-bold border border-yellow-500/30 px-2 rounded">Tech: {job.technicianName || '⚠ Unassigned'}</span>
                      </div>
                   </div>
                   {(job.supervisorObs || job.customerImages) && <div className="flex gap-2 mt-2">{job.supervisorObs && <span className="text-[10px] bg-purple-900 text-purple-300 px-2 py-1 rounded">📝 Obs Recorded</span>}{job.customerImages && <span className="text-[10px] bg-blue-900 text-blue-300 px-2 py-1 rounded">📸 Photos Linked</span>}</div>}
                </div>
              )})}
            </div>

            <div className="lg:col-span-1 bg-slate-800 rounded-xl border border-slate-700 p-6 h-fit sticky top-24 max-h-[90vh] overflow-y-auto">
              {!selectedJobId ? <div className="text-center text-slate-500 py-10">Select Job</div> : (() => {
                  const job = jobs.find(j => j.id === selectedJobId);
                  const total = (job.parts?.reduce((a,b)=>a+b.total,0)||0) + (job.labor?.reduce((a,b)=>a+b.total,0)||0) + (job.expenses?.reduce((a,b)=>a+Number(b.amount),0)||0);
                  const filteredInventory = getFilteredInventory(job);

                  return (
                    <div className="space-y-6">
                      <h2 className="text-xl font-black border-b border-slate-700 pb-2">{job.regNo || job.vehicleNumber}</h2>
                      <div className="text-xs text-slate-400 flex gap-2">
                        <span className="bg-slate-700 px-2 rounded">{job.bodyType || 'Hatchback'}</span>
                        <span className="bg-slate-700 px-2 rounded">{job.fuelType}</span>
                      </div>
                      
                      {/* 🔔 NEW: APPROVALS ALERT BOX */}
                      {job.partRequests?.some(r => r.status === 'PENDING') && (
                        <div className="bg-orange-900/30 border border-orange-500 rounded-xl p-4">
                           <h3 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-2">⚠️ APPROVALS NEEDED</h3>
                           <div className="space-y-3">
                              {job.partRequests.filter(r => r.status === 'PENDING').map((req, i) => (
                                 <div key={i} className="bg-black p-3 rounded flex flex-col gap-2">
                                    <div className="text-sm font-bold text-white">{req.name}</div>
                                    <div className="flex gap-2">
                                       <button onClick={() => askCustomerApproval(job, req.name)} className="flex-1 bg-blue-600 py-1 rounded text-[10px] font-bold">📲 ASK CUSTOMER</button>
                                       <button onClick={() => approveRequest(job, req)} className="flex-1 bg-green-600 py-1 rounded text-[10px] font-bold">✅ APPROVE</button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                      )}

                      <button onClick={() => sendWhatsApp(job)} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg animate-pulse"><span>📲</span> Send WhatsApp Estimate</button>
                      
                      <div className="flex gap-2">
                         <button onClick={printJobCard} className="flex-1 bg-white text-black font-bold py-3 rounded border border-slate-400 hover:bg-slate-200 shadow-md">🖨️ PRINT</button>
                         <button onClick={() => startEdit(job)} className="flex-1 bg-yellow-500 text-black font-bold py-3 rounded border border-yellow-600 hover:bg-yellow-400 shadow-md">✏️ EDIT</button>
                      </div>

                      <div className="flex justify-between font-bold text-green-400"><span>TOTAL EST:</span><span>₹{total}</span></div>
                      
                      <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                         <h3 className="text-xs font-bold text-blue-400 uppercase mb-2">Add Items</h3>
                         
                         {/* SMART DROPDOWN */}
                         <div className="mb-2">
                           <select onChange={handleMasterItemSelect} className="w-full bg-slate-700 border border-slate-500 rounded p-2 text-xs text-white">
                             <option value="">-- Select Smart Item --</option>
                             {filteredInventory.map((item, index) => (
                               <option key={index} value={item.name}>{item.name} (₹{item.price})</option>
                             ))}
                           </select>
                           <div className="text-[9px] text-slate-500 text-right mt-1">
                             Showing {filteredInventory.length} items for {job.fuelType} {job.bodyType || 'Hatchback'}
                           </div>
                         </div>

                         <div className="space-y-2">
                            <select className="w-full bg-slate-800 rounded p-2 text-xs" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}><option value="PART">Spare Part</option><option value="LABOR">Labor</option></select>
                            <input className="w-full bg-slate-800 rounded p-2 text-xs" placeholder="Desc" value={newItem.desc} onChange={e => setNewItem({...newItem, desc: e.target.value})} />
                            <div className="flex gap-2">
                               <input type="number" className="w-1/3 bg-slate-800 rounded p-2 text-xs" placeholder="Qty" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: e.target.value})} />
                               <input type="number" className="w-1/3 bg-slate-800 rounded p-2 text-xs" placeholder="Price" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                               <button onClick={addLineItem} className="w-1/3 bg-blue-600 rounded font-bold text-xs">ADD</button>
                            </div>
                         </div>
                         <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                            {job.parts?.map(p => <div key={p.id} className="text-[10px] flex justify-between text-slate-400"><span>{p.desc}</span><span>₹{p.total}</span></div>)}
                            {job.labor?.map(l => <div key={l.id} className="text-[10px] flex justify-between text-slate-400"><span>{l.desc}</span><span>₹{l.total}</span></div>)}
                         </div>
                      </div>
                      
                      <div className="flex gap-2">
                         <Link href={`/bill/${job.id}`} className="flex-1 bg-blue-600 hover:bg-blue-500 text-center py-3 rounded font-bold text-sm shadow-lg">INVOICE</Link>
                         <button onClick={() => deleteJob(job.id)} className="px-4 bg-red-900/50 text-red-400 rounded">🗑️</button>
                      </div>
                    </div>
                  );
              })()}
            </div>
          </div>
        )}

        {/* ================= PRINT TEMPLATE (RESTORED) ================= */}
        <div className="hidden print:block text-black bg-white p-6 font-mono">
           {selectedJobId && (() => {
              const job = jobs.find(j => j.id === selectedJobId);
              if(!job) return null;
              return (
                 <div className="space-y-6">
                    <div className="flex justify-between border-b-2 border-black pb-4">
                       <div><h1 className="text-3xl font-black">JOB CARD</h1><p className="text-sm font-bold">WORKSHOP FLOOR TICKET</p></div>
                       <div className="text-right"><h2 className="text-2xl font-bold">{job.regNo}</h2><p className="text-sm">{new Date(job.createdAt?.seconds * 1000).toLocaleString()}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-400 pb-4 text-sm">
                       <div><p><strong>Customer:</strong> {job.customerName}</p><p><strong>Phone:</strong> {job.customerPhone}</p><p><strong>Model:</strong> {job.model} ({job.fuelType} {job.bodyType})</p></div>
                       <div><p><strong>Technician:</strong> {job.technicianName}</p><p><strong>Service:</strong> {job.serviceType}</p><p><strong>Odometer:</strong> {job.odometer} KM</p></div>
                    </div>
                    <div className="border-b border-gray-400 pb-4 text-sm">
                       <h3 className="font-bold uppercase mb-2 text-lg underline">Inspection & Obs</h3>
                       <p className="mb-2"><strong>Supervisor Notes:</strong> {job.supervisorObs || 'None'}</p>
                       <div className="grid grid-cols-3 gap-2"><p><strong>Fuel:</strong> {job.fuelLevel}%</p><p><strong>Tyres:</strong> {job.tyreCondition}</p><p><strong>Warning Lights:</strong> {Object.keys(job.warningLights || {}).filter(k=>job.warningLights[k]).join(', ') || 'None'}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 border-b border-gray-400 pb-4 text-sm">
                       <div><h3 className="font-bold uppercase mb-1">Body Damages</h3><ul className="list-disc pl-4">{Object.entries(job.bodyDamages || {}).map(([panel, types]) => <li key={panel}>{panel}: {types.join(', ')}</li>)}{Object.keys(job.bodyDamages || {}).length === 0 && <li>None</li>}</ul></div>
                       <div><h3 className="font-bold uppercase mb-1">Inventory (Checked)</h3><ul className="list-disc pl-4">{Object.keys(job.inventory || {}).filter(k => job.inventory[k]).map(k => <li key={k}>{k}</li>)}</ul></div>
                    </div>
                    <div>
                       <h3 className="font-bold uppercase mb-2 text-lg underline">Technical Tasks</h3>
                       <div className="border border-black p-4">
                          <h4 className="font-bold mb-2">Mechanical / Service:</h4>
                          <ul className="space-y-2 mb-4">{job.blocks?.[0]?.steps.map((step, i) => <li key={i} className="flex gap-2"><span>[ ]</span> {step}</li>)}{job.blocks?.[0]?.steps.length === 0 && <li>No specific tasks assigned.</li>}</ul>
                          <h4 className="font-bold mb-2">Electrical / Other:</h4>
                          <ul className="space-y-2">{job.blocks?.[1]?.steps.map((step, i) => <li key={i} className="flex gap-2"><span>[ ]</span> {step}</li>)}</ul>
                       </div>
                    </div>
                    <div className="flex justify-between pt-16 mt-8">
                       <div className="border-t border-black w-1/3 pt-2 text-center text-xs">Customer Sig</div><div className="border-t border-black w-1/3 pt-2 text-center text-xs">Technician Sig</div><div className="border-t border-black w-1/3 pt-2 text-center text-xs">Supervisor Sig</div>
                    </div>
                 </div>
              );
           })()}
        </div>

      </div>
    </div>
  );
}