"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import { db, auth } from '../../firebase';

// 📋 MASTER DATA CONSTANTS (PRESERVED)
const INVENTORY_ITEMS = ["Spare Wheel", "Jack & Rod", "Tool Kit", "Stereo Faceplate", "Mud Flaps", "Floor Mats", "God Idol / Perfume", "Manual / Service Book"];
const BODY_PANELS = ["Front Bumper", "Rear Bumper", "Bonnet", "Roof", "Left Doors", "Right Doors", "Tailgate", "Windshield"];
const WARNING_LIGHTS = ["Check Engine", "ABS", "Airbag", "Battery", "Oil Pressure", "Coolant Temp", "DEF"];
const FUEL_TYPES = ["Petrol", "Diesel", "Electric (EV)", "CNG / Hybrid"];
const BODY_TYPES = ["Hatchback", "Sedan", "SUV", "Luxury", "Commercial"];
const SERVICE_TYPES = ["PMS (Periodic Service)", "Running Repair", "Accidental", "Breakdown", "Warranty Check"];
// 🛡️ EXISTING CONSTANT USED AS FALLBACK
const TECHNICIANS = ["Raju Mechanic", "John Doe", "Electrical Specialist", "General Technician"];

const USAGE_PROFILES = [
  { label: "🐢 Low (School/Shop ~15km/day)", value: "LOW" },
  { label: "🚗 Medium (Office ~40km/day)", value: "MEDIUM" },
  { label: "🚀 High (Highway ~80km/day)", value: "HIGH" },
  { label: "🚕 Commercial (Taxi ~200km/day)", value: "COMMERCIAL" }
];

// 🧠 AI RULES (PRESERVED)
const AI_RULES = [
  { keywords: ["brake", "noise", "grinding", "squeak", "pad", "disc"], tasks: ["Inspect Brake Pads (Front/Rear)", "Check Disc Rotor condition", "Bleed Brake Fluid"], parts: ["Brake Pads", "Brake Shoe", "Disc Rotor", "Brake Fluid"] },
  { keywords: ["ac", "cooling", "hot", "smell", "compressor"], tasks: ["Check AC Gas Pressure", "Inspect Cabin Filter", "Check Compressor Clutch"], parts: ["AC Gas (R134a)", "Cabin Filter", "Compressor Oil"] },
  { keywords: ["engine", "oil", "leak", "smoke", "sump"], tasks: ["Check Oil Level & Quality", "Inspect Tappet Cover Packing", "Check for Sump Leaks"], parts: ["Engine Oil", "Oil Filter", "Tappet Packing", "Sump Sealant"] },
  { keywords: ["vibration", "wobble", "alignment", "steering"], tasks: ["Check Wheel Balancing", "Inspect Steering Rack", "Check Suspension Bushes"], parts: ["Wheel Weights", "Tie Rod End", "Lower Arm Bush"] },
  { keywords: ["start", "battery", "cranking", "dim"], tasks: ["Battery Voltage Test", "Alternator Charging Check", "Starter Motor Current Draw"], parts: ["Battery (DIN)", "Alternator Carbon", "Starter Solenoid"] },
  { keywords: ["service", "general", "pms", "oil change"], tasks: ["Replace Engine Oil", "Replace Oil Filter", "Clean Air Filter", "Top-up Fluids", "General Wash"], parts: ["Engine Oil", "Oil Filter", "Air Filter", "Screen Wash", "Coolant"] },
  { keywords: ["misfire", "jerk", "missing", "p0300"], tasks: ["Check Spark Plugs", "Check Ignition Coils", "Check Fuel Injectors"], parts: ["Spark Plugs", "Ignition Coil", "Injector Cleaner"] }
];

export default function SupervisorDashboard() {
  const router = useRouter(); 
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('DASHBOARD'); 
  const [jobs, setJobs] = useState([]);
  const [inventoryDB, setInventoryDB] = useState([]); 
  const [obdDB, setObdDB] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);

  // 🆕 V88.5 ADDITIONS:
  const [usersList, setUsersList] = useState([]); // For Live Team Sync
  const [stagingItems, setStagingItems] = useState([]); // For PMS Auto-Fill
  const [upsellSuggestions, setUpsellSuggestions] = useState([]); // For AI Suggestions

  // --- MASTER STATE ---
  const [formData, setFormData] = useState({
    customerName: '', customerPhone: '', billingName: '', gstin: '',
    regNo: '', make: '', model: '', variant: '', color: '', 
    bodyType: 'Hatchback', fuelType: 'Petrol', serviceType: 'PMS', 
    odometer: '', vin: '', engineNo: '', keyNo: '', batteryId: '',
    fuelLevel: '50', tyreCondition: 'OK',
    usageProfile: 'MEDIUM',
    priority: 'NORMAL', // 🆕 Priority
    inventory: {}, warningLights: {}, bodyDamages: {}, 
    supervisorObs: '', 
    customerImages: '', voiceNoteLink: '', obdScanReport: '', 
    inspectionPhotos: [], 
    obdAttachments: [],   
    testDriveReport: '', promisedDelivery: '', complaints: '', technicianName: '', 
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
  const [customLightInput, setCustomLightInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // 1. SECURITY
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Expanded role check
            if (['admin', 'supervisor', 'technician', 'mechanic'].includes(userData.role?.toLowerCase())) {
              setUser({...currentUser, ...userData}); 
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

  // 2. LIVE DATA SYNC (WITH ERROR SHIELDS 🛡️)
  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
        console.warn("⚠️ Job Sync Paused (Check Permissions):", error.code);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setInventoryDB(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
        console.warn("⚠️ Inventory Sync Paused:", error.code);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchOBD = async () => {
      try {
        const snap = await getDocs(collection(db, "obd_library"));
        setObdDB(snap.docs.map(d => d.data()));
      } catch (e) { console.warn("OBD Library inaccessible"); }
    };
    fetchOBD();
  }, []);

  // 🆕 V88.5: TEAM SYNC WITH PERMISSION SHIELD 🛡️
  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snapshot) => {
        setUsersList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
        // THIS CATCHES THE "PERMISSION-DENIED" CRASH
        console.warn("⚠️ Team Sync Blocked by Rules. Switching to Offline Mode.");
        // We will fallback to TECHNICIANS constant automatically
    });
    return () => unsub();
  }, []);

  // 🆕 V88.5: PMS AUTO-ALLOCATION ENGINE 🧠
  useEffect(() => {
      if (activeTab === 'NEW_ENTRY' && formData.serviceType.includes('PMS')) {
          // Normalize Inputs
          const currentFuel = (formData.fuelType || '').toLowerCase();
          const currentBody = (formData.bodyType || '').toLowerCase();

          const pmsMatches = inventoryDB.filter(item => {
              const tags = (item.tags || []).map(t => t.toLowerCase());
              const name = item.name.toLowerCase();
              
              // 1. Must be PMS related
              const isPMSTagged = tags.includes('pms');
              
              // 2. Must match Car OR be Universal
              const matchesFuel = tags.includes(currentFuel) || name.includes(currentFuel);
              const matchesBody = tags.includes(currentBody) || name.includes(currentBody);
              const isUniversal = tags.includes('universal') || (!tags.includes('petrol') && !tags.includes('diesel'));

              return isPMSTagged && (matchesFuel || matchesBody || isUniversal);
          });

          // Prepare Staging Data
          const staged = pmsMatches.map(item => ({
              ...item,
              status: (Number(item.stock) || 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
              // SUV gets 6L oil, others 4L (Simple Heuristic)
              suggestedQty: item.name.toLowerCase().includes('oil') && currentBody === 'suv' ? 6 : 1
          }));
          setStagingItems(staged);
      } else {
          setStagingItems([]);
      }
  }, [formData.serviceType, formData.fuelType, formData.bodyType, activeTab, inventoryDB]);

  // UPSELL ENGINE
  useEffect(() => {
      if(activeTab !== 'NEW_ENTRY') return;
      const text = (formData.complaints + " " + formData.supervisorObs + " " + formData.obdScanReport).toLowerCase();
      const suggestions = [];
      AI_RULES.forEach(rule => {
          if (rule.keywords.some(k => text.includes(k)) && rule.parts) {
              rule.parts.forEach(partKey => {
                  const match = inventoryDB.find(i => i.name.toLowerCase().includes(partKey.toLowerCase()));
                  if(match) suggestions.push(match);
              });
          }
      });
      const unique = [...new Map(suggestions.map(item => [item.id, item])).values()];
      setUpsellSuggestions(unique);
  }, [formData.complaints, formData.supervisorObs, formData.obdScanReport, inventoryDB]);

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const toggleShift = async () => {
      if(!user) return;
      const newStatus = user.attendance === 'PRESENT' ? 'ABSENT' : 'PRESENT';
      setUser({...user, attendance: newStatus}); // Optimistic Update
      try {
        await updateDoc(doc(db, "users", user.uid), { attendance: newStatus });
      } catch (e) { console.warn("Offline attendance toggle"); }
  };

  const getTATStatus = (promisedTime) => {
    if (!promisedTime) return { color: "text-slate-400", label: "No Deadline" };
    let due = new Date(promisedTime);
    const now = new Date();
    if (isNaN(due.getTime()) && promisedTime.includes(':')) {
       const [h, m] = promisedTime.split(':'); due = new Date(); due.setHours(h, m, 0);
    }
    if (isNaN(due.getTime())) return { color: "text-slate-400", label: "Invalid Time" };
    const diffMs = due - now;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    const dateStr = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const timeStr = due.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diffMs < 0) return { color: "text-red-500 animate-pulse font-black", label: `OVERDUE (+${Math.abs(diffHrs)}h)` };
    if (diffHrs < 1) return { color: "text-yellow-500 font-bold", label: `Urgent (${diffMins}m left)` };
    return { color: "text-green-500 font-bold", label: `Due ${dateStr}, ${timeStr}` };
  };

  const getCardStyle = (job) => {
    if (job.priority === 'ESCALATED') return 'border-red-600 bg-red-950 animate-pulse ring-2 ring-red-500'; 
    if (job.priority === 'VIP') return 'border-yellow-500 bg-yellow-900/20 ring-1 ring-yellow-400';
    if (job.status === 'WORK_PAUSED' || job.status === 'WAITING_PARTS') return 'border-red-500 bg-red-900/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
    const tat = getTATStatus(job.promisedDelivery);
    if (tat.label.includes("OVERDUE") && job.status !== 'READY' && job.status !== 'DELIVERED') return 'border-red-600 bg-red-950 animate-pulse';
    if (job.status === 'WORK_IN_PROGRESS') return 'border-orange-500 bg-orange-900/20';
    if (job.status === 'READY') return 'border-green-500 bg-green-900/20';
    return 'border-slate-700 bg-slate-800 hover:border-slate-500';
  };

  const updateForm = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };
  const toggleInventory = (item) => setFormData(p => ({ ...p, inventory: { ...p.inventory, [item]: !p.inventory[item] } }));
  const toggleWarningLight = (light) => setFormData(p => ({ ...p, warningLights: { ...p.warningLights, [light]: !p.warningLights[light] } }));
  const addCustomWarningLight = () => { if(!customLightInput) return; setFormData(p => ({ ...p, warningLights: { ...p.warningLights, [customLightInput]: true } })); setCustomLightInput(""); };
  const toggleBodyDamage = (panel, type) => {
    const damages = formData.bodyDamages[panel] || [];
    const newDamages = damages.includes(type) ? damages.filter(d => d !== type) : [...damages, type];
    setFormData(p => ({ ...p, bodyDamages: { ...p.bodyDamages, [panel]: newDamages } }));
  };
  const handleSmartAttachment = (e, field) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    const promises = files.map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; 
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                    resolve(compressedBase64);
                }
            }
        });
    });
    Promise.all(promises).then(base64Images => {
        setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), ...base64Images] }));
        setIsUploading(false);
    });
  };

  const removeAttachment = (index, field) => {
      const updated = formData[field].filter((_, i) => i !== index);
      updateForm(field, updated);
  };

  const generateAIWorkPlan = () => {
    const inputText = (formData.complaints + " " + formData.supervisorObs + " " + formData.obdScanReport).toLowerCase();
    const suggestedTasks = [];
    const detectedCodes = [];
    AI_RULES.forEach(rule => { if (rule.keywords.some(k => inputText.includes(k))) suggestedTasks.push(...rule.tasks); });
    const obdMatches = inputText.match(/p[0-9]{4}/g);
    if (obdMatches && obdDB.length > 0) {
       obdMatches.forEach(code => {
          const found = obdDB.find(entry => entry.code === code.toUpperCase());
          if (found) {
             detectedCodes.push(found.code);
             if(found.diagnostic_steps) suggestedTasks.push(...found.diagnostic_steps.map(s => `[${found.code}] ${s}`));
          }
       });
    }
    if (suggestedTasks.length === 0) { alert("ℹ️ AI: No specific patterns matched."); return; }
    const updatedBlocks = [...formData.blocks];
    const uniqueTasks = [...new Set([...updatedBlocks[0].steps, ...suggestedTasks])];
    updatedBlocks[0].steps = uniqueTasks;
    setFormData(prev => ({ ...prev, blocks: updatedBlocks }));
    if (detectedCodes.length > 0) alert(`🧠 AI DETECTED OBD CODES: ${detectedCodes.join(", ")}\n\nAdded specialized diagnostic steps from your library.`);
    else alert(`✨ AI predicted ${suggestedTasks.length} tasks based on symptoms!`);
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

  // 🆕 V88.5: REMOVE ITEM (CORRECTION)
  const removeItem = async (jobId, type, itemId) => {
      if(!confirm("Remove this item?")) return;
      const job = jobs.find(j => j.id === jobId);
      const field = type === 'PART' ? 'parts' : 'labor';
      const updatedList = (job[field] || []).filter(item => item.id !== itemId);
      await updateDoc(doc(db, "jobs", jobId), { [field]: updatedList });
  };

  // 🆕 V88.5: ADD STAGED ITEM (FROM AI)
  const addStagedItem = (item) => {
      const isProcure = item.status === 'OUT_OF_STOCK';
      const newItemEntry = {
          id: Date.now() + Math.random(),
          category: 'PART',
          desc: item.name + (isProcure ? ' (PROCURE)' : ''),
          qty: item.suggestedQty || 1,
          price: item.price,
          total: (item.suggestedQty || 1) * item.price
      };
      setFormData(prev => ({ ...prev, parts: [...prev.parts, newItemEntry] }));
  };

  const getFilteredInventory = (job) => {
    if (!job) return [];
    return inventoryDB.filter(item => {
      const tags = (item.tags || []).map(t => t.toLowerCase()); 
      return (tags.includes('universal') || tags.includes(job.fuelType?.toLowerCase()) || tags.includes(job.bodyType?.toLowerCase()));
    });
  };

  const handleMasterItemSelect = (e) => {
    const selectedName = e.target.value;
    const foundItem = inventoryDB.find(item => item.name === selectedName);
    if (foundItem) { setNewItem({ category: foundItem.category, desc: foundItem.name, qty: 1, price: foundItem.price }); }
  };

  const startEdit = (job) => {
    setFormData({ ...job, inspectionPhotos: job.inspectionPhotos || [], obdAttachments: job.obdAttachments || [] });
    setIsEditing(true);
    setSelectedJobId(job.id); 
    setActiveTab('NEW_ENTRY'); 
    window.scrollTo(0, 0); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.regNo) { alert("⚠️ Registration Number is Missing!"); return; }
    if(!formData.technicianName) { alert("⚠️ Technician Required!"); return; }
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
      setFormData({ customerName: '', customerPhone: '', billingName: '', gstin: '', regNo: '', make: '', model: '', variant: '', color: '', bodyType: 'Hatchback', fuelType: 'Petrol', serviceType: 'PMS', odometer: '', vin: '', engineNo: '', keyNo: '', batteryId: '', fuelLevel: '50', tyreCondition: 'OK', usageProfile: 'MEDIUM', priority: 'NORMAL', inventory: {}, warningLights: {}, bodyDamages: {}, supervisorObs: '', customerImages: '', voiceNoteLink: '', obdScanReport: '', inspectionPhotos: [], obdAttachments: [], testDriveReport: '', promisedDelivery: '', complaints: '', technicianName: '', blocks: [ { name: 'Mechanical', status: 'PENDING', steps: [] }, { name: 'Electrical', status: 'PENDING', steps: [] }, { name: 'QC', status: 'PENDING', steps: ['Final Road Test', 'OBD Scan'] } ], status: 'ESTIMATE', expenses: [], parts: [], labor: [] });
      setIsEditing(false);
    } catch (err) { alert("Error: " + err.message); }
  };

  const deleteJob = async (id) => { if(confirm("Delete?")) await deleteDoc(doc(db, "jobs", id)); };
  
  // 🆕 V88.5: WHATSAPP FORMATTED FIX
  const sendWhatsApp = (job) => {
    if(!job.customerPhone) { alert("⚠️ No Customer Phone Number Found!"); return; }
    
    const total = (job.parts?.reduce((a,b)=>a+b.total,0)||0) + (job.labor?.reduce((a,b)=>a+b.total,0)||0) + (job.expenses?.reduce((a,b)=>a+Number(b.amount),0)||0);
    const damageCount = Object.keys(job.bodyDamages||{}).length;
    
    // EXPLICIT %0A for LINE BREAKS
    const message = `🚗 *JobCard Pro - Service Estimate*%0A%0A*Vehicle:* ${job.model} (${job.regNo})%0A*Customer:* ${job.customerName}%0A%0A🔎 *PRE-SERVICE INSPECTION:*%0A• Tech Obs: ${job.supervisorObs || 'Standard Check'}%0A• Fuel: ${job.fuelLevel}% | Tyres: ${job.tyreCondition}%0A• Damages: ${damageCount} Panels Marked%0A• Photos Attached: ${job.inspectionPhotos?.length || 0}%0A%0A💰 *ESTIMATE:*%0A• Parts: ₹${job.parts?.reduce((a,b)=>a+b.total,0)||0}%0A• Labor: ₹${job.labor?.reduce((a,b)=>a+b.total,0)||0}%0A%0A*TOTAL: ₹${total}*%0A%0AReply APPROVE to start work.`;
    const cleanPhone = job.customerPhone.replace(/\D/g, '').slice(-10); 
    const url = `https://wa.me/91${cleanPhone}?text=${message}`;
    window.open(url, '_blank');
  };

  // 🆕 V88.5: ROBUST PRINT
  const printJobCard = () => { 
      if(!selectedJobId) { alert("Select a Job First!"); return; }
      window.print(); 
  };
  
  const approveRequest = async (job, request) => {
    const updatedRequests = job.partRequests.map(r => r.id === request.id ? { ...r, status: 'APPROVED' } : r);
    const masterItem = inventoryDB.find(i => i.name === request.name);
    const price = masterItem ? masterItem.price : 0;
    const newPart = { id: Date.now(), category: 'PART', desc: request.name, qty: 1, price: price, total: price };
    await updateDoc(doc(db, "jobs", job.id), { partRequests: updatedRequests, parts: [...(job.parts || []), newPart], status: 'WORK_IN_PROGRESS' });
    alert(`✅ Request Approved: ${request.name}`);
  };

  const askCustomerApproval = (job, requestName) => {
    const msg = `*⚠️ ADDITIONAL APPROVAL NEEDED*\n*Vehicle:* ${job.regNo}\n\nTechnician found issue with: *${requestName}*\n\nPlease reply APPROVE to proceed.`;
    window.open(`https://wa.me/91${job.customerPhone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-500 font-bold animate-pulse">🔒 Verifying Access...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans pb-20 print:bg-white print:text-black">
      {/* NAVBAR */}
      <div className="print:hidden bg-slate-800 border-b border-slate-700 sticky top-0 z-50 shadow-xl p-4 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-black text-blue-500">JOB<span className="text-white">CARD</span> <span className="text-xs text-slate-500">V88.5 STABLE</span></h1>
        <div className="flex gap-4 items-center">
           {/* CLOCK IN BUTTON */}
           <button onClick={toggleShift} className={`hidden md:block px-3 py-1 rounded text-xs font-bold border transition-all ${user?.attendance === 'PRESENT' ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_lime]' : 'bg-slate-700 border-slate-500 text-slate-400'}`}>
               {user?.attendance === 'PRESENT' ? '🟢 ON DUTY' : '🔴 OFF DUTY'}
           </button>

           <div className="flex bg-slate-900 rounded-lg p-1">
              <button onClick={() => {setActiveTab('DASHBOARD'); setSelectedJobId(null); setIsEditing(false)}} className={`px-4 py-1 rounded text-xs md:text-sm font-bold transition-all ${activeTab === 'DASHBOARD' ? 'bg-blue-600 shadow' : 'text-slate-400'}`}>📡 Fleet</button>
              <button onClick={() => {setActiveTab('NEW_ENTRY'); setIsEditing(false)}} className={`px-4 py-1 rounded text-xs md:text-sm font-bold transition-all ${activeTab === 'NEW_ENTRY' ? 'bg-green-600 shadow' : 'text-slate-400'}`}>➕ New Job</button>
           </div>
           <button onClick={handleLogout} className="bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded border border-red-600/30 text-xs font-bold transition-all">🔓 LOGOUT</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 print:p-0 print:max-w-none">
        
        {/* ================= VIEW 1: INTAKE FORM ================= */}
        <div className="print:hidden">
        {activeTab === 'NEW_ENTRY' && (
          <div className="max-w-5xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className={`p-6 border-b border-slate-700 flex justify-between items-center ${isEditing ? 'bg-blue-900' : 'bg-slate-900'}`}>
               <h2 className="text-xl font-bold text-white">{isEditing ? '✏️ EDITING VEHICLE ENTRY' : 'New Vehicle Intake'}</h2>
               {/* SENTIMENT SELECTOR */}
               <select className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs font-bold" value={formData.priority} onChange={e => updateForm('priority', e.target.value)}>
                   <option value="NORMAL">🙂 Standard</option>
                   <option value="VIP">⭐ VIP Customer</option>
                   <option value="URGENT">🔥 Urgent</option>
                   <option value="ESCALATED">😡 Escalated</option>
               </select>
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
             
              {/* 2. VEHICLE DNA */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider border-b border-slate-700 pb-2">2. Vehicle DNA</h3>
                <div className="grid grid-cols-2 gap-4"><input required placeholder="REG NO" className="bg-slate-900 border border-slate-600 rounded-lg p-4 uppercase font-bold text-yellow-400" value={formData.regNo} onChange={e => updateForm('regNo', e.target.value.toUpperCase())} /><input required placeholder="Model" className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.model} onChange={e => updateForm('model', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] text-blue-400 font-bold ml-1">BODY TYPE</label><select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.bodyType} onChange={e => updateForm('bodyType', e.target.value)}>{BODY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div><label className="text-[10px] text-blue-400 font-bold ml-1">FUEL TYPE</label><select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.fuelType} onChange={e => updateForm('fuelType', e.target.value)}>{FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div></div>
                <div className="grid grid-cols-2 gap-4"><input placeholder="Variant" className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.variant} onChange={e => updateForm('variant', e.target.value)} /><input placeholder="Color" className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.color} onChange={e => updateForm('color', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4"><input required type="number" placeholder="Odometer" className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.odometer} onChange={e => updateForm('odometer', e.target.value)} /><select className="bg-slate-900 border border-slate-600 rounded-lg p-4" value={formData.serviceType} onChange={e => updateForm('serviceType', e.target.value)}>{SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
 
                {/* 🆕 V88.5: SMART STAGING AREA (PMS + UPSELLS) */}
                {(stagingItems.length > 0 || upsellSuggestions.length > 0) && (
                    <div className="bg-slate-900/80 border-l-4 border-yellow-500 p-4 rounded-lg space-y-3">
                        <div className="flex justify-between items-center"><h4 className="font-bold text-yellow-400 text-xs uppercase flex items-center gap-2">✨ AI Recommendations & Staging</h4></div>
                        {/* PMS KIT */}
                        {stagingItems.length > 0 && <div className="space-y-1"><div className="text-[10px] text-slate-500 font-bold">PMS KIT DETECTED:</div>{stagingItems.map((item, i) => (<div key={i} className="flex justify-between items-center bg-black/40 p-2 rounded border border-slate-700"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${item.status === 'IN_STOCK' ? 'bg-green-500' : 'bg-red-500'}`}></div><span className="text-xs text-white">{item.name}</span></div><button type="button" onClick={() => addStagedItem(item)} className="text-[10px] bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded font-bold">[+] ADD</button></div>))}</div>}
                        {/* UPSELLS */}
                        {upsellSuggestions.length > 0 && <div className="space-y-1 border-t border-slate-700 pt-2"><div className="text-[10px] text-slate-500 font-bold">CONTEXTUAL UPSELLS:</div>{upsellSuggestions.map((item, i) => (<div key={i} className="flex justify-between items-center bg-black/40 p-2 rounded border border-purple-900/50"><div className="flex items-center gap-2"><span className="text-xs text-purple-300">💡 {item.name}</span></div><button type="button" onClick={() => addStagedItem(item)} className="text-[10px] bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded font-bold">[+] ADD</button></div>))}</div>}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-t border-slate-700 pt-4 mt-2"><input placeholder="VIN" className="bg-slate-900 border border-slate-600 rounded-lg p-4 uppercase" value={formData.vin} onChange={e => updateForm('vin', e.target.value)} /><input placeholder="Engine No" className="bg-slate-900 border border-slate-600 rounded-lg p-4 uppercase" value={formData.engineNo} onChange={e => updateForm('engineNo', e.target.value)} /></div>
                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mt-2"><label className="text-xs font-bold text-blue-400 uppercase mb-2 block">🚙 Vehicle Lifestyle</label><select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 font-bold text-white" value={formData.usageProfile} onChange={e => updateForm('usageProfile', e.target.value)}>{USAGE_PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <label className="text-xs font-bold text-blue-400 uppercase mb-2 block">⏰ Promised Delivery Date & Time</label>
                    <input type="datetime-local" className="bg-slate-800 border border-slate-600 rounded p-4 text-white font-bold w-full" value={formData.promisedDelivery} onChange={e => updateForm('promisedDelivery', e.target.value)} />
                </div>
              </div>
              
              {/* 3. DISPUTE SHIELD */}
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-600 space-y-8">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2"><h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">3. Dispute Shield</h3></div>
                <div><label className="text-xs font-bold text-slate-500 mb-4 block">FUEL LEVEL</label><input type="range" min="0" max="100" step="25" className="w-full h-2 bg-slate-700 rounded-lg accent-yellow-400" value={formData.fuelLevel} onChange={e => updateForm('fuelLevel', e.target.value)} /><div className="flex justify-between text-xs text-slate-400 mt-2 font-mono"><span>E</span><span>25</span><span>50</span><span>75</span><span>F</span></div></div>
                <div><label className="text-xs font-bold text-slate-500 mb-2 block">TYRE CONDITION</label><div className="flex gap-4">{['OK', 'WORN', 'CRITICAL'].map(status => <button key={status} type="button" onClick={() => setFormData({...formData, tyreCondition: status})} className={`flex-1 py-3 rounded-lg text-xs font-bold border-2 transition-all ${formData.tyreCondition === status ? (status === 'OK' ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white') : 'bg-slate-800 border-slate-600 text-slate-400'}`}>{status}</button>)}</div></div>
                <div>
                    <label className="text-xs font-bold text-slate-500 mb-2 block">WARNING LIGHTS</label>
                    <div className="flex flex-wrap gap-2 mb-2">{[...WARNING_LIGHTS, ...Object.keys(formData.warningLights).filter(k => !WARNING_LIGHTS.includes(k) && formData.warningLights[k])].map(light => (<button key={light} type="button" onClick={() => toggleWarningLight(light)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${formData.warningLights[light] ? 'bg-red-900/80 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-slate-800 border-slate-600 text-slate-500'}`}>{light}</button>))}</div>
                    <div className="flex gap-2"><input placeholder="Add Other (e.g. Glow Plug)..." className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-white flex-grow" value={customLightInput} onChange={e => setCustomLightInput(e.target.value)} /><button type="button" onClick={addCustomWarningLight} className="bg-blue-600 px-4 rounded text-xs font-bold text-white hover:bg-blue-500">+ ADD</button></div>
                </div>
                <div className="grid grid-cols-2 gap-3">{INVENTORY_ITEMS.map(item => <div key={item} onClick={() => toggleInventory(item)} className={`cursor-pointer p-4 rounded-lg border-2 flex items-center justify-between transition-all ${formData.inventory[item] ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-800 border-slate-700'}`}><span className={`text-xs font-bold uppercase ${formData.inventory[item] ? 'text-blue-300' : 'text-slate-500'}`}>{item}</span>{formData.inventory[item] && <span className="text-blue-500">✓</span>}</div>)}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{BODY_PANELS.map(panel => <div key={panel} className="bg-slate-800 p-2 rounded border border-slate-700"><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{panel}</div><div className="flex gap-1">{['S', 'D', 'C'].map(code => {const type = code === 'S' ? 'Scratch' : code === 'D' ? 'Dent' : 'Crack'; return (<button key={type} type="button" onClick={() => toggleBodyDamage(panel, type)} className={`flex-1 text-[9px] py-1 rounded border ${formData.bodyDamages[panel]?.includes(type) ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-600'}`}>{code}</button>);})}</div></div>)}</div>
              </div>
              
              {/* 4. INSPECTION & MEDIA */}
              <div className="space-y-4 pt-4 border-t border-slate-700">
                 <h3 className="text-xl font-black text-white bg-blue-600 p-3 rounded-lg text-center shadow-lg">📸 SUPERVISOR INSPECTION & PHOTOS</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-xs font-bold text-blue-400 uppercase">PRE-SERVICE INSPECTION REPORT</label><textarea placeholder="Type technical observations..." className="w-full bg-slate-900 border-2 border-blue-500/50 rounded-xl p-4 h-32 text-sm" value={formData.supervisorObs} onChange={e => updateForm('supervisorObs', e.target.value)} /></div>
                    <div className="space-y-4">
                       <div><label className="text-xs font-bold text-blue-400 uppercase">PHOTOS LINK (Optional)</label><input placeholder="Google Photos Link..." className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-sm" value={formData.customerImages} onChange={e => updateForm('customerImages', e.target.value)} /></div>
                       <div className="bg-slate-900 border-2 border-dashed border-slate-600 p-4 rounded-xl">
                          <label className="text-xs font-bold text-blue-400 uppercase mb-2 flex justify-between"><span>ATTACH PHOTOS (CAMERA/GALLERY)</span>{isUploading && <span className="text-yellow-400 animate-pulse">Compressing...</span>}</label>
                          <input type="file" multiple accept="image/*" onChange={(e) => handleSmartAttachment(e, 'inspectionPhotos')} className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 mb-3"/>
                          {formData.inspectionPhotos?.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-2">{formData.inspectionPhotos.map((img, i) => (<div key={i} className="relative min-w-[60px] h-[60px]"><img src={img} className="w-full h-full object-cover rounded border border-slate-500" /><button type="button" onClick={() => removeAttachment(i, 'inspectionPhotos')} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">×</button></div>))}</div>)}
                       </div>
                       <div className="bg-slate-900 border-2 border-dashed border-slate-600 p-4 rounded-xl">
                          <label className="text-xs font-bold text-yellow-400 uppercase mb-2 block">OBD / SCANNER REPORT (ATTACH)</label>
                          <input placeholder="Or type codes... (e.g. P0300, P0171)" className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs mb-2 font-mono text-yellow-400" value={formData.obdScanReport} onChange={e => updateForm('obdScanReport', e.target.value)} />
                          <input type="file" accept="image/*" onChange={(e) => handleSmartAttachment(e, 'obdAttachments')} className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-yellow-600 file:text-black hover:file:bg-yellow-500"/>
                          {formData.obdAttachments?.length > 0 && (<div className="flex gap-2 mt-2">{formData.obdAttachments.map((img, i) => (<div key={i} className="relative min-w-[60px] h-[60px]"><img src={img} className="w-full h-full object-cover rounded border border-yellow-500" /><button type="button" onClick={() => removeAttachment(i, 'obdAttachments')} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">×</button></div>))}</div>)}
                       </div>
                    </div>
                 </div>
              </div>
              
              {/* 5. WORK SCOPE & AI */}
              <div className="space-y-4 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">5. Work Scope & AI</h3>
                <textarea required placeholder="Customer Complaints..." className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 h-20 text-xs" value={formData.complaints} onChange={e => updateForm('complaints', e.target.value)} />
                <button type="button" onClick={generateAIWorkPlan} className="w-full bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-600 hover:to-blue-600 text-white p-3 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2">✨ CLICK TO AUTO-GENERATE TASKS (AI + OBD)</button>
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
                       <div className="flex-grow flex gap-1">
                           {/* 🆕 V88.5: ROBUST TECH DROPDOWN WITH FALLBACKS */}
                           <select required className="flex-grow bg-slate-900 border border-slate-600 rounded-lg p-4 font-bold text-white focus:border-green-500" value={formData.technicianName} onChange={e => updateForm('technicianName', e.target.value)}>
                               <option value="">-- Select Technician --</option>
                               {/* DB Users (if available) */}
                               {usersList.filter(u => ['technician', 'Technician', 'mechanic', 'supervisor'].includes(u.role)).map(tech => (
                                   <option key={tech.id} value={tech.name}>{tech.name} {tech.attendance === 'PRESENT' ? '🟢' : '⚪'}</option>
                               ))}
                               {/* Fallbacks (always available) */}
                               {TECHNICIANS.map(t => <option key={t} value={t}>[Manual] {t}</option>)}
                           </select>
                       </div>
                       <button type="submit" className={`w-1/3 text-white rounded-xl font-bold text-lg shadow-lg ${isEditing ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}>{isEditing ? '🔄 UPDATE JOB' : 'CREATE JOB'}</button>
                    </div>
                 </div>
              </div>
            </form>
          </div>
        )}
        </div>

        {/* ================= VIEW 2: DASHBOARD ================= */}
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            <div className="lg:col-span-2 space-y-4">
              {jobs.map((job) => {
                const hasPendingRequests = job.partRequests?.some(r => r.status === 'PENDING');
                const tat = getTATStatus(job.promisedDelivery);
                
                return (
                <div key={job.id} onClick={() => setSelectedJobId(job.id)} className={`cursor-pointer p-5 rounded-xl border-l-4 transition-all ${getCardStyle(job)} ${selectedJobId === job.id ? 'ring-2 ring-blue-500' : ''}`}>
                   
                   <div className="flex justify-between items-start mb-2">
                      <div>
                          <div className="flex items-center gap-2">
                              <h3 className="text-xl font-black font-mono text-white">{job.regNo || job.vehicleNumber}</h3>
                              {job.priority === 'VIP' && <span className="text-xs bg-yellow-500 text-black px-1 rounded font-bold">⭐ VIP</span>}
                              {job.priority === 'URGENT' && <span className="text-xs bg-red-600 text-white px-1 rounded font-bold animate-pulse">🔥 URGENT</span>}
                          </div>
                          <div className="flex gap-2 items-center text-xs text-slate-300 mt-1">
                              <span>{job.model}</span>
                              {job.color && <span className="bg-black/30 px-1 rounded border border-white/20">{job.color}</span>}
                          </div>
                      </div>
                      <div className="text-right">
                         {/* ALERT BADGES */}
                         {hasPendingRequests && <span className="block text-[10px] bg-red-600 text-white px-2 py-1 rounded mb-1 animate-pulse">🔔 PART REQUEST</span>}
                         
                         {/* STATUS BADGE */}
                         <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${job.status === 'WORK_PAUSED' ? 'bg-red-600 text-white animate-pulse' : job.status === 'WORK_IN_PROGRESS' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-white'}`}>
                            {job.status.replace(/_/g, " ")}
                         </div>

                         {/* TECH NAME */}
                         <span className="block mt-1 text-[9px] text-yellow-500">{job.technicianName}</span>
                      </div>
                   </div>

                   {/* LIVE INFO ROW */}
                   <div className="flex justify-between items-end mt-4 pt-3 border-t border-white/10">
                       <div className="text-[10px] text-slate-400">
                           {/* Show PAUSE REASON if paused */}
                           {job.status === 'WORK_PAUSED' && <div className="text-red-300 font-bold mb-1 animate-pulse">⚠️ {job.pauseReason}</div>}
                           
                           {/* Show FUTURE ADVISORY if ready */}
                           {job.futureAdvisory?.length > 0 && <div className="text-purple-400 font-bold mb-1">🔮 {job.futureAdvisory.length} Future Items</div>}
                           
                           <div>{job.serviceType}</div>
                       </div>
                       
                       {/* TAT CLOCK */}
                       <div className={`text-right text-[10px] font-bold ${tat.color}`}>
                           <div>{tat.label}</div>
                       </div>
                   </div>

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
                      
                      {/* V88.5: VEHICLE VITALS BOX */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-black/30 p-2 rounded border border-slate-700/50">
                          <div><div className="text-[9px] text-slate-500">ODOMETER</div><div className="font-mono font-bold text-white">{job.odometer} KM</div></div>
                          <div><div className="text-[9px] text-slate-500">FUEL</div><div className="font-mono font-bold text-white">{job.fuelLevel}%</div></div>
                          <div><div className="text-[9px] text-slate-500">BODY</div><div className="font-mono font-bold text-white">{job.bodyType}</div></div>
                          <div><div className="text-[9px] text-slate-500">FUEL TYPE</div><div className="font-mono font-bold text-white">{job.fuelType}</div></div>
                      </div>
                      
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
                         <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {job.parts?.map(p => (
                                <div key={p.id} className="text-[10px] flex justify-between items-center text-slate-400 border-b border-slate-700/50 pb-1">
                                    <span>{p.desc} (x{p.qty})</span>
                                    <div className="flex items-center gap-2">
                                        <span>₹{p.total}</span>
                                        {/* 🆕 V88.5: REMOVE BUTTON */}
                                        <button onClick={() => removeItem(job.id, 'PART', p.id)} className="text-red-500 hover:text-red-400 font-bold">❌</button>
                                    </div>
                                </div>
                            ))}
                            {job.labor?.map(l => (
                                <div key={l.id} className="text-[10px] flex justify-between items-center text-slate-400 border-b border-slate-700/50 pb-1">
                                    <span>{l.desc}</span>
                                    <div className="flex items-center gap-2">
                                        <span>₹{l.total}</span>
                                        {/* 🆕 V88.5: REMOVE BUTTON */}
                                        <button onClick={() => removeItem(job.id, 'LABOR', l.id)} className="text-red-500 hover:text-red-400 font-bold">❌</button>
                                    </div>
                                </div>
                            ))}
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

        {/* ================= PRINT TEMPLATE (PRESERVED) ================= */}
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
                       <div><p><strong>Customer:</strong> {job.customerName}</p><p><strong>Phone:</strong> {job.customerPhone}</p><p><strong>Model:</strong> {job.model} - {job.color || 'N/A'}</p></div>
                       <div><p><strong>Technician:</strong> {job.technicianName}</p><p><strong>Service:</strong> {job.serviceType}</p><p><strong>Odometer:</strong> {job.odometer} KM</p></div>
                    </div>
                    <div className="border-b border-gray-400 pb-4 text-sm">
                       <h3 className="font-bold uppercase mb-2 text-lg underline">Inspection & Obs</h3>
                       <p className="mb-2"><strong>Supervisor Notes:</strong> {job.supervisorObs || 'None'}</p>
                       <div className="grid grid-cols-3 gap-2"><p><strong>Fuel:</strong> {job.fuelLevel}%</p><p><strong>Tyres:</strong> {job.tyreCondition}</p><p><strong>Warning Lights:</strong> {Object.keys(job.warningLights || {}).filter(k=>job.warningLights[k]).join(', ') || 'None'}</p></div>
                       {(job.inspectionPhotos?.length > 0 || job.obdAttachments?.length > 0) && (
                         <div className="mt-2 text-xs">
                            <strong>Attachments:</strong> {job.inspectionPhotos?.length} Photos, {job.obdAttachments?.length} OBD Reports attached digitally.
                         </div>
                       )}
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