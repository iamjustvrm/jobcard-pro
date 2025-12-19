"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'; 
import { initializeApp, getApp, deleteApp } from 'firebase/app'; 
import { db, auth } from '../../firebase';

// 🏷️ COMPATIBILITY TAGS
const VEHICLE_TAGS = ["Universal", "Hatchback", "Sedan", "SUV", "Luxury", "Petrol", "Diesel", "EV"];

export default function AdminPanel() {
  const router = useRouter(); 
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  // DATA STATES
  const [activeTab, setActiveTab] = useState('DASHBOARD'); 
  const [inventory, setInventory] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [staffList, setStaffList] = useState([]); 
  
  // FORMS
  const [newItem, setNewItem] = useState({ name: '', category: 'PART', price: '', tags: ['Universal'] });
  const [newStaff, setNewStaff] = useState({ email: '', password: '', role: 'technician' }); 

  // 1. SECURITY
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser || !currentUser.email.includes('admin')) {
        router.push('/');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. LIVE SYNC
  useEffect(() => {
    const qInv = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
    const unsubInv = onSnapshot(qInv, (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const qJobs = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsubJobs = onSnapshot(qJobs, (snap) => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qStaff = query(collection(db, "users"));
    const unsubStaff = onSnapshot(qStaff, (snap) => setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubInv(); unsubJobs(); unsubStaff(); };
  }, []);

  // --- ANALYTICS ENGINE ---
  const calculateMetrics = () => {
    let totalRevenue = 0;
    let totalParts = 0;
    let totalLabor = 0;
    const techPerformance = {};
    jobs.forEach(job => {
      const jobParts = job.parts?.reduce((a,b)=>a+b.total,0) || 0;
      const jobLabor = job.labor?.reduce((a,b)=>a+b.total,0) || 0;
      const jobTotal = jobParts + jobLabor;
      totalRevenue += jobTotal;
      totalParts += jobParts;
      totalLabor += jobLabor;
      const tech = job.technicianName || 'Unassigned';
      if(!techPerformance[tech]) techPerformance[tech] = { jobs: 0, revenue: 0 };
      techPerformance[tech].jobs += 1;
      techPerformance[tech].revenue += jobTotal;
    });
    return { totalRevenue, totalParts, totalLabor, techPerformance, jobCount: jobs.length };
  };
  const metrics = calculateMetrics();

  // --- CRM ENGINE (NEW V36) ---
  const getDueCustomers = () => {
     const uniqueCustomers = {};
     const sixMonthsAgo = new Date();
     sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6); // Threshold Date

     // Iterate jobs (which are ordered by Latest First)
     jobs.forEach(job => {
        const phone = job.customerPhone?.replace(/\D/g, '').slice(-10);
        if(!phone) return;

        // Since jobs are desc, the first time we see a phone, it is the LATEST visit
        if (!uniqueCustomers[phone]) {
           const jobDate = job.createdAt ? new Date(job.createdAt.seconds * 1000) : new Date();
           uniqueCustomers[phone] = {
              name: job.customerName,
              phone: phone, // Clean phone
              originalPhone: job.customerPhone,
              lastCar: job.model,
              regNo: job.regNo, // Store latest Reg No
              lastDate: jobDate,
              daysAgo: Math.floor((new Date() - jobDate) / (1000 * 60 * 60 * 24)),
              isDue: jobDate < sixMonthsAgo
           };
        }
     });

     // Return only those who are due
     return Object.values(uniqueCustomers).filter(c => c.isDue).sort((a,b) => b.daysAgo - a.daysAgo);
  };
  
  const dueList = getDueCustomers();

  const sendReminder = (c) => {
    const msg = `Hello ${c.name}, gentle reminder from JobCard Pro!\n\nYour ${c.lastCar} (${c.regNo}) visited us ${c.daysAgo} days ago. It is time for a General Service check-up to ensure smooth performance.\n\nReply YES to book a slot!`;
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- HANDLERS ---
  const handleAddItem = async (e) => {
    e.preventDefault();
    if(!newItem.name || !newItem.price) return alert("Fill all fields!");
    await addDoc(collection(db, "inventory"), { ...newItem, price: Number(newItem.price), createdAt: serverTimestamp() });
    setNewItem({ name: '', category: 'PART', price: '', tags: ['Universal'] });
    alert("✅ Item Added!");
  };

  const deleteItem = async (id) => { if(confirm("Remove?")) await deleteDoc(doc(db, "inventory", id)); };
  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const toggleTag = (tag) => {
    setNewItem(prev => {
      const newTags = prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag];
      return { ...prev, tags: newTags };
    });
  };

  const downloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,RegNo,Model,Customer,Phone,Technician,TotalAmount\n"; 
    jobs.forEach(job => {
      const total = (job.parts?.reduce((a,b)=>a+b.total,0)||0) + (job.labor?.reduce((a,b)=>a+b.total,0)||0);
      const date = new Date(job.createdAt?.seconds * 1000).toLocaleDateString();
      csvContent += `${date},${job.regNo},${job.model},${job.customerName},${job.customerPhone},${job.technicianName},${total}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `workshop_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  // 👮‍♂️ STAFF CREATION (SHADOW APP)
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if(!newStaff.email || !newStaff.password) return alert("Enter Email & Password");
    try {
      const secondaryApp = initializeApp(db.app.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStaff.email, newStaff.password);
      const uid = userCredential.user.uid;
      await setDoc(doc(db, "users", uid), { email: newStaff.email, role: newStaff.role, createdAt: serverTimestamp() });
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      alert(`✅ Staff Account Created: ${newStaff.email} (${newStaff.role})`);
      setNewStaff({ email: '', password: '', role: 'technician' }); 
    } catch (error) {
      alert("Error creating staff: " + error.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-amber-500 font-bold animate-pulse">🏛️ Opening Executive Suite...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans pb-20">
      
      {/* 📱 MOBILE OPTIMIZED HEADER */}
      <div className="bg-slate-900 border-b border-amber-600/30 sticky top-0 z-50 p-4 shadow-2xl backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
           {/* Row 1: Logo & Mobile Actions */}
           <div className="flex justify-between items-center w-full md:w-auto">
              <div><h1 className="text-2xl font-black text-amber-500 tracking-widest">MASTER<span className="text-white">ADMIN</span></h1><p className="text-[10px] text-slate-400">FINANCIAL COMMAND CENTER</p></div>
              <div className="flex gap-2 md:hidden">
                  <Link href="/supervisor" className="bg-slate-800 border border-slate-600 px-3 py-2 rounded text-[10px] font-bold">⬅ FLOOR</Link>
                  <button onClick={handleLogout} className="bg-red-900/20 text-red-400 px-3 py-2 rounded border border-red-600/30 text-[10px] font-bold">LOGOUT</button>
              </div>
           </div>
           {/* Row 2: Navigation Tabs (Scrollable) */}
           <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 whitespace-nowrap scrollbar-hide w-full md:w-auto">
              <button onClick={() => setActiveTab('DASHBOARD')} className={`px-4 py-2 rounded text-xs font-bold transition-all shrink-0 ${activeTab === 'DASHBOARD' ? 'bg-amber-600 text-black' : 'text-slate-400 hover:text-white bg-slate-800'}`}>📊 OVERVIEW</button>
              <button onClick={() => setActiveTab('INVENTORY')} className={`px-4 py-2 rounded text-xs font-bold transition-all shrink-0 ${activeTab === 'INVENTORY' ? 'bg-amber-600 text-black' : 'text-slate-400 hover:text-white bg-slate-800'}`}>📦 INVENTORY</button>
              <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded text-xs font-bold transition-all shrink-0 ${activeTab === 'REPORTS' ? 'bg-amber-600 text-black' : 'text-slate-400 hover:text-white bg-slate-800'}`}>📂 REPORTS</button>
              <button onClick={() => setActiveTab('STAFF')} className={`px-4 py-2 rounded text-xs font-bold transition-all shrink-0 ${activeTab === 'STAFF' ? 'bg-amber-600 text-black' : 'text-slate-400 hover:text-white bg-slate-800'}`}>👥 STAFF</button>
              <button onClick={() => setActiveTab('CRM')} className={`px-4 py-2 rounded text-xs font-bold transition-all shrink-0 ${activeTab === 'CRM' ? 'bg-green-600 text-black' : 'text-slate-400 hover:text-white bg-slate-800'}`}>📞 CRM</button>
           </div>
           {/* Desktop Actions */}
           <div className="hidden md:flex gap-2 items-center">
              <Link href="/supervisor" className="bg-slate-800 border border-slate-600 hover:bg-slate-700 px-3 py-2 rounded text-[10px] font-bold">⬅ OPERATION FLOOR</Link>
              <button onClick={handleLogout} className="bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-2 rounded border border-red-600/30 text-[10px] font-bold">LOGOUT</button>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* ================= TAB 1: FINANCIAL COCKPIT ================= */}
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-amber-500/20 shadow-xl"><h3 className="text-xs text-slate-400 font-bold uppercase">Total Revenue</h3><div className="text-3xl font-black text-amber-500 mt-2">₹{metrics.totalRevenue.toLocaleString()}</div></div>
                 <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl"><h3 className="text-xs text-slate-400 font-bold uppercase">Total Jobs</h3><div className="text-3xl font-black text-white mt-2">{metrics.jobCount}</div></div>
                 <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl"><h3 className="text-xs text-slate-400 font-bold uppercase">Parts Sales</h3><div className="text-3xl font-black text-blue-400 mt-2">₹{metrics.totalParts.toLocaleString()}</div></div>
                 <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl"><h3 className="text-xs text-slate-400 font-bold uppercase">Labor Earnings</h3><div className="text-3xl font-black text-green-400 mt-2">₹{metrics.totalLabor.toLocaleString()}</div></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                    <h2 className="text-lg font-bold text-amber-500 mb-6 flex items-center gap-2">🏆 Technician Leaderboard</h2>
                    <div className="space-y-4">{Object.entries(metrics.techPerformance).sort(([,a], [,b]) => b.revenue - a.revenue).map(([tech, stats], index) => (<div key={tech} className="flex items-center gap-4"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index === 0 ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-400'}`}>{index + 1}</div><div className="flex-grow"><div className="flex justify-between text-sm font-bold"><span>{tech}</span><span className="text-green-400">₹{stats.revenue.toLocaleString()}</span></div><div className="w-full bg-slate-700 h-2 rounded-full mt-2 overflow-hidden"><div className="bg-blue-500 h-full rounded-full" style={{ width: `${(stats.revenue / metrics.totalRevenue) * 100}%` }}></div></div><div className="text-[10px] text-slate-500 mt-1">{stats.jobs} Jobs Completed</div></div></div>))}</div>
                 </div>
                 <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                    <h2 className="text-lg font-bold text-blue-400 mb-6">📡 Live Activity Feed</h2>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">{jobs.slice(0, 10).map(job => (<div key={job.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700"><div><div className="font-bold text-sm text-white">{job.regNo}</div><div className="text-[10px] text-slate-400">{job.model} • {job.serviceType}</div></div><div className="text-right"><div className="font-mono font-bold text-green-400 text-sm">₹{((job.parts?.reduce((a,b)=>a+b.total,0)||0) + (job.labor?.reduce((a,b)=>a+b.total,0)||0)).toLocaleString()}</div><div className="text-[9px] text-slate-500">{new Date(job.createdAt?.seconds * 1000).toLocaleDateString()}</div></div></div>))}</div>
                 </div>
              </div>
           </div>
        )}

        {/* ================= TAB 2: INVENTORY ================= */}
        {activeTab === 'INVENTORY' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl h-fit">
                 <h2 className="text-lg font-bold text-blue-400 mb-4 uppercase tracking-wider">Add New SKU</h2>
                 <form onSubmit={handleAddItem} className="space-y-4">
                    <div><label className="text-xs text-slate-500 font-bold">ITEM NAME</label><input className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-blue-500" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="Item Name" /></div>
                    <div className="flex gap-4"><div className="w-1/2"><label className="text-xs text-slate-500 font-bold">TYPE</label><select className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}><option value="PART">📦 Part</option><option value="LABOR">🔧 Labor</option></select></div><div className="w-1/2"><label className="text-xs text-slate-500 font-bold">PRICE (₹)</label><input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white font-mono text-yellow-400" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} placeholder="0" /></div></div>
                    <div><label className="text-xs text-slate-500 font-bold mb-2 block">COMPATIBILITY</label><div className="flex flex-wrap gap-2">{VEHICLE_TAGS.map(tag => (<button key={tag} type="button" onClick={() => toggleTag(tag)} className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${newItem.tags.includes(tag) ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>{tag}</button>))}</div></div>
                    <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg mt-4">SAVE TO DATABASE</button>
                 </form>
              </div>
              <div className="lg:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl">
                 <h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center"><span>Master Database</span><span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-400">{inventory.length} Items</span></h2>
                 <div className="overflow-y-auto max-h-[70vh] space-y-2 pr-2">{inventory.map(item => (<div key={item.id} className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition-all"><div><div className="font-bold text-white flex items-center gap-2">{item.category === 'PART' ? '📦' : '🔧'} {item.name}</div><div className="flex gap-2 mt-1">{item.tags?.map(t => <span key={t} className="text-[10px] bg-slate-800 border border-slate-600 text-slate-400 px-1 rounded">{t}</span>)}</div></div><div className="flex items-center gap-4"><span className="font-mono text-yellow-400 font-bold">₹{item.price}</span><button onClick={() => deleteItem(item.id)} className="text-red-500 hover:bg-red-900/30 p-2 rounded">🗑️</button></div></div>))}</div>
              </div>
           </div>
        )}

        {/* ================= TAB 3: REPORTS ================= */}
        {activeTab === 'REPORTS' && (
           <div className="bg-slate-800 rounded-2xl border border-slate-700 p-10 text-center space-y-6">
              <div className="text-6xl">📂</div><h2 className="text-2xl font-black text-white">Data Vault</h2>
              <p className="text-slate-400 max-w-md mx-auto">Download a complete CSV export of all job cards.</p>
              <button onClick={downloadCSV} className="bg-amber-600 hover:bg-amber-500 text-black px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all">⬇ DOWNLOAD FULL REPORT (.CSV)</button>
           </div>
        )}

        {/* ================= TAB 4: STAFF MANAGEMENT ================= */}
        {activeTab === 'STAFF' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Create User Form */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl">
                 <h2 className="text-lg font-bold text-purple-400 mb-4 uppercase tracking-wider">Create Staff Account</h2>
                 <form onSubmit={handleCreateStaff} className="space-y-4">
                    <div><label className="text-xs text-slate-500 font-bold">EMAIL (USERNAME)</label><input className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} placeholder="tech@workshop.com" /></div>
                    <div><label className="text-xs text-slate-500 font-bold">PASSWORD</label><input type="password" className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white" value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} placeholder="Strong Password" /></div>
                    <div><label className="text-xs text-slate-500 font-bold">ROLE</label><select className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})}><option value="technician">🔧 Technician</option><option value="supervisor">👷 Supervisor</option><option value="admin">🏛️ Admin</option></select></div>
                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg mt-4">CREATE ACCOUNT</button>
                    <p className="text-[10px] text-slate-500 text-center mt-2">Note: This will create a secure login. The user can sign in immediately.</p>
                 </form>
              </div>

              {/* Staff List */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl">
                 <h2 className="text-lg font-bold text-white mb-4">Active Staff</h2>
                 <div className="space-y-2">
                    {staffList.map(s => (
                       <div key={s.id} className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-700">
                          <div><div className="font-bold text-white">{s.email}</div><div className="text-xs text-slate-400 capitalize">{s.role}</div></div>
                          <div className="text-xs text-slate-500">Active</div>
                       </div>
                    ))}
                    {staffList.length === 0 && <div className="text-slate-500 italic">No staff records found.</div>}
                 </div>
              </div>
           </div>
        )}

        {/* ================= TAB 5: CRM (ACTIVATED V36) ================= */}
        {activeTab === 'CRM' && (
           <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 min-h-[50vh]">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                 <div>
                    <h2 className="text-2xl font-black text-green-500">RETENTION<span className="text-white">ENGINE</span></h2>
                    <p className="text-xs text-slate-400">Customers inactive for 6+ months. Call them back!</p>
                 </div>
                 <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
                    <span className="text-xs text-slate-500 font-bold uppercase">Pending Callbacks</span>
                    <div className="text-2xl font-black text-white text-center">{dueList.length}</div>
                 </div>
              </div>

              {/* CRM LIST */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {dueList.map((customer, index) => (
                    <div key={index} className="bg-slate-900 p-4 rounded-xl border-l-4 border-l-green-600 flex flex-col justify-between hover:bg-slate-800 transition-all">
                       <div className="mb-4">
                          <div className="flex justify-between items-start">
                             <h3 className="text-lg font-bold text-white">{customer.name}</h3>
                             <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded">{customer.daysAgo} Days Ago</span>
                          </div>
                          <p className="text-sm text-slate-300 mt-1">{customer.lastCar} <span className="text-slate-500">({customer.regNo})</span></p>
                          <p className="text-xs text-slate-500 mt-2">Last Visit: {customer.lastDate.toLocaleDateString()}</p>
                       </div>
                       <button onClick={() => sendReminder(customer)} className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
                          <span>📲</span> Send WhatsApp Reminder
                       </button>
                    </div>
                 ))}
              </div>

              {dueList.length === 0 && (
                 <div className="text-center py-20">
                    <div className="text-4xl mb-4">🎉</div>
                    <h3 className="text-xl font-bold text-white">All Clear!</h3>
                    <p className="text-slate-400 text-sm">No inactive customers found. Your retention is 100%.</p>
                 </div>
              )}
           </div>
        )}

      </div>
    </div>
  );
}