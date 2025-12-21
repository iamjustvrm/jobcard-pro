"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- THEME STATE (Default: Dark 'Glory') ---
  const [darkMode, setDarkMode] = useState(true);

  // --- DATA STATES ---
  const [jobs, setJobs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [activeTab, setActiveTab] = useState('DASHBOARD'); // DASHBOARD | TEAM | JOBS | INVENTORY | USERS | REPORTS
  
  // --- UI STATES ---
  const [selectedJob, setSelectedJob] = useState(null); 
  const [jobDetailTab, setJobDetailTab] = useState('INFO'); // INFO | TASKS | FINANCE | LOGS
  const [commissionRate, setCommissionRate] = useState(5); 
  const [searchTerm, setSearchTerm] = useState('');

  // --- FORMS ---
  const [newItem, setNewItem] = useState({ name: '', price: '', stock: '', category: 'General' });
  const [newUser, setNewUser] = useState({ email: '', password: 'password123', role: 'technician', name: '' });

  // 1. SECURITY
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push('/');
      else { setUser(currentUser); setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. LIVE DATA SYNC
  useEffect(() => {
    const qJobs = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsubJobs = onSnapshot(qJobs, (snap) => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qInv = query(collection(db, "inventory"), orderBy("name", "asc"));
    const unsubInv = onSnapshot(qInv, (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qUsers = query(collection(db, "users"));
    const unsubUsers = onSnapshot(qUsers, (snap) => setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubJobs(); unsubInv(); unsubUsers(); };
  }, []);

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  // --- NEW: CLIPBOARD UTILITY ---
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Tracking Link Copied to Clipboard!");
  };

  // --- ANALYTICS ENGINE ---
  const calculateFinancials = () => {
      let totalParts = 0;
      let totalLabor = 0;
      let totalRevenue = 0;
      
      jobs.forEach(job => {
          const p = Array.isArray(job.parts) ? job.parts.reduce((a, b) => a + (Number(b.total) || 0), 0) : 0;
          const l = Array.isArray(job.labor) ? job.labor.reduce((a, b) => a + (Number(b.total) || 0), 0) : 0;
          totalParts += p;
          totalLabor += l;
          totalRevenue += (p + l);
      });
      return { totalParts, totalLabor, totalRevenue };
  };

  const financials = calculateFinancials();

  const getTeamStats = () => {
    const stats = {};
    jobs.forEach(job => {
        const tech = job.technicianName || 'Unassigned';
        if(!stats[tech]) stats[tech] = { name: tech, jobsCount: 0, activeNow: null, laborRevenue: 0, status: 'IDLE' };
        
        const jobTotal = (Array.isArray(job.parts) ? job.parts.reduce((a,b)=>a+(Number(b.total)||0),0) : 0) + 
                         (Array.isArray(job.labor) ? job.labor.reduce((a,b)=>a+(Number(b.total)||0),0) : 0);

        if(job.status === 'READY' || job.status === 'DELIVERED') {
            stats[tech].jobsCount += 1;
            stats[tech].laborRevenue += jobTotal; 
        }
        if(job.status === 'WORK_IN_PROGRESS') {
            stats[tech].activeNow = job.regNo;
            stats[tech].status = 'WORKING';
        } else if (job.status === 'WORK_PAUSED') {
            stats[tech].activeNow = `${job.regNo} (Paused)`;
            stats[tech].status = 'PAUSED';
        }
    });
    return Object.values(stats).filter(s => s.name !== 'Unassigned').sort((a,b) => b.laborRevenue - a.laborRevenue);
  };
  const teamStats = getTeamStats();

  // --- DOWNLOAD ENGINE ---
  const downloadReport = (type) => {
      const headers = ["Job ID", "Date", "Customer", "Phone", "Reg No", "Model", "Tech", "Status", "Parts Total", "Labor Total", "Grand Total", "Supervisor Notes"];
      const rows = jobs.map(job => {
          const pTotal = job.parts?.reduce((a,b)=>a+(Number(b.total)||0),0) || 0;
          const lTotal = job.labor?.reduce((a,b)=>a+(Number(b.total)||0),0) || 0;
          const dateStr = job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
          const safe = (txt) => `"${(txt || '').toString().replace(/"/g, '""')}"`;
          return [job.id, dateStr, safe(job.customerName), job.customerPhone, job.regNo, job.model, job.technicianName, job.status, pTotal, lTotal, pTotal+lTotal, safe(job.supervisorObs)].join(",");
      });

      if (type === 'PDF') { window.print(); return; }

      const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `JOB_AUDIT_REPORT_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- ACTIONS ---
  const handleAddItem = async () => {
    if(!newItem.name || !newItem.price) return alert("Details Required!");
    await addDoc(collection(db, "inventory"), { ...newItem, price: Number(newItem.price), stock: Number(newItem.stock) });
    setNewItem({ name: '', price: '', stock: '', category: 'General' });
  };
  const handleDeleteItem = async (id) => { if(confirm("Delete?")) await deleteDoc(doc(db, "inventory", id)); };
  
  const handleCreateUser = async () => {
      if(!newUser.email) return;
      await addDoc(collection(db, "users"), newUser); 
      alert(`User ${newUser.name} Added!`);
      setNewUser({ email: '', password: 'password123', role: 'technician', name: '' });
  };
  const handleDeleteUser = async (id) => { if(confirm("Revoke Access?")) await deleteDoc(doc(db, "users", id)); };

  // --- THEME ENGINE ---
  const theme = {
      bg: darkMode ? 'bg-[#0f172a] text-slate-200' : 'bg-slate-50 text-slate-900',
      card: darkMode ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-200 shadow-sm',
      header: darkMode ? 'bg-[#020617] border-slate-800' : 'bg-white border-slate-200 shadow-sm',
      textMain: darkMode ? 'text-white' : 'text-slate-900',
      textSub: darkMode ? 'text-slate-400' : 'text-slate-500',
      input: darkMode ? 'bg-[#0f172a] border-slate-600 text-white' : 'bg-white border-slate-300 text-black',
      tableHead: darkMode ? 'bg-[#0f172a] text-slate-400' : 'bg-slate-50 text-slate-600',
      tableRow: darkMode ? 'border-slate-700 hover:bg-[#334155]' : 'border-slate-100 hover:bg-blue-50',
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center font-bold font-mono ${darkMode ? 'bg-black text-green-500' : 'bg-white text-blue-600'}`}>INITIALIZING DATA CORE...</div>;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${theme.bg}`}>
      
      {/* HEADER */}
      <div className={`px-6 py-3 sticky top-0 z-50 border-b flex justify-between items-center print:hidden ${theme.header}`}>
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tighter text-blue-500">ADMIN<span className={theme.textMain}>HQ</span></h1>
            <span className="text-[10px] font-mono bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded border border-blue-600/50">V63 RESTORED</span>
        </div>
        <div className="flex gap-3 items-center">
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full transition-all ${darkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-200 text-slate-600'}`}>
                {darkMode ? '☀️' : '🌑'}
            </button>

            <nav className={`flex p-1 rounded-lg ${darkMode ? 'bg-[#0f172a]' : 'bg-slate-200'}`}>
                {['DASHBOARD', 'TEAM', 'JOBS', 'INVENTORY', 'USERS', 'REPORTS'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : theme.textSub + ' hover:text-blue-500'}`}>{tab}</button>
                ))}
            </nav>
            <button onClick={() => router.push('/admin/obd')} className={`px-3 py-1.5 rounded text-xs font-bold border border-dashed border-slate-500 ${theme.textSub} hover:text-white`}>🧠 OBD</button>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-md text-xs font-bold ml-2 shadow-lg shadow-red-900/50">EXIT</button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6">

        {/* ================= TAB 1: DASHBOARD ================= */}
        {activeTab === 'DASHBOARD' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className={`p-6 rounded-xl border-l-4 border-green-500 shadow-lg ${theme.card}`}>
                        <h3 className={`${theme.textSub} text-[10px] font-bold uppercase tracking-widest`}>Total Revenue</h3>
                        <p className={`text-4xl font-black mt-2 ${theme.textMain}`}>₹{financials.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className={`p-6 rounded-xl border-l-4 border-blue-500 shadow-lg ${theme.card}`}>
                        <h3 className={`${theme.textSub} text-[10px] font-bold uppercase tracking-widest`}>Job Volume</h3>
                        <p className={`text-4xl font-black mt-2 ${theme.textMain}`}>{jobs.length}</p>
                    </div>
                    <div className={`p-6 rounded-xl border-l-4 border-purple-500 shadow-lg ${theme.card}`}>
                        <h3 className={`${theme.textSub} text-[10px] font-bold uppercase tracking-widest`}>Avg Ticket Value</h3>
                        <p className={`text-4xl font-black mt-2 ${theme.textMain}`}>₹{jobs.length > 0 ? Math.round(financials.totalRevenue / jobs.length).toLocaleString() : 0}</p>
                    </div>
                    <div className={`p-6 rounded-xl border-l-4 border-red-500 shadow-lg ${theme.card}`}>
                        <h3 className={`${theme.textSub} text-[10px] font-bold uppercase tracking-widest`}>Active Cars</h3>
                        <p className={`text-4xl font-black mt-2 ${theme.textMain}`}>{jobs.filter(j => j.status !== 'DELIVERED').length}</p>
                    </div>
                </div>
            </div>
        )}

        {/* ================= TAB 2: TEAM (LEADERBOARD) ================= */}
        {activeTab === 'TEAM' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <div className={`rounded-xl p-8 border ${theme.card} relative overflow-hidden`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500"></div>
                    <h2 className="text-2xl font-black mb-8 text-center text-yellow-500 uppercase tracking-widest flex items-center justify-center gap-2">🏆 Technician Leaderboard</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        {teamStats.slice(0, 3).map((tech, i) => (
                            <div key={tech.name} className={`relative p-6 rounded-2xl border-2 flex flex-col items-center justify-center transform hover:scale-105 transition-all ${i === 0 ? 'border-yellow-500 bg-yellow-500/10 h-64 order-2 shadow-[0_0_30px_rgba(234,179,8,0.3)]' : i === 1 ? 'border-slate-400 bg-slate-400/10 h-56 order-1' : 'border-orange-700 bg-orange-700/10 h-48 order-3'}`}>
                                <div className="text-6xl mb-2 filter drop-shadow-xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                                <h3 className={`text-xl font-black uppercase text-center ${theme.textMain}`}>{tech.name}</h3>
                                <div className="mt-auto text-center w-full">
                                    <div className="text-sm font-mono font-bold text-green-500 bg-black/30 rounded px-2 py-1 mb-1">{tech.jobsCount} Jobs</div>
                                    <div className={`text-lg font-bold ${theme.textSub}`}>₹{(tech.laborRevenue || 0).toLocaleString()}</div>
                                </div>
                                <div className="absolute -top-4 -right-4 text-[80px] opacity-5 font-black pointer-events-none">{i+1}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className={`lg:col-span-2 rounded-xl p-6 border ${theme.card}`}>
                        <h3 className={`font-bold uppercase mb-4 ${theme.textSub}`}>📡 Live Floor Monitor</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {teamStats.map(tech => (
                                <div key={tech.name} className={`p-4 rounded-xl border relative overflow-hidden ${tech.status === 'WORKING' ? 'border-green-500 bg-green-500/10' : tech.status === 'PAUSED' ? 'border-red-500 bg-red-500/10' : 'border-slate-700 bg-slate-800'}`}>
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold">{tech.name}</span>
                                        <span className={`w-2 h-2 rounded-full ${tech.status === 'WORKING' ? 'bg-green-500 animate-ping' : 'bg-slate-500'}`}></span>
                                    </div>
                                    <div className="text-xs opacity-70">{tech.activeNow || 'Idle'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className={`rounded-xl p-6 border ${theme.card}`}>
                        <h3 className={`font-bold uppercase mb-4 ${theme.textSub}`}>Payout Preview</h3>
                        <div className="flex items-center gap-2 mb-4 p-2 bg-purple-900/20 rounded border border-purple-500/30">
                            <span className="text-xs text-purple-400">Comm %:</span>
                            <input type="number" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} className="w-12 bg-transparent border-b border-purple-500 text-center font-bold text-white" />
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {teamStats.map(tech => (
                                <div key={tech.name} className="flex justify-between text-sm border-b border-slate-700 pb-1">
                                    <span>{tech.name}</span>
                                    <span className="font-mono text-green-400">₹{Math.round((tech.laborRevenue || 0) * (commissionRate/100))}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ================= TAB 3: JOBS MANAGER (FULL DOSSIER + NEW TRACKING BUTTON) ================= */}
        {activeTab === 'JOBS' && (
            <div className="grid grid-cols-12 gap-6 h-[85vh]">
                
                {/* LIST PANEL */}
                <div className={`col-span-12 lg:col-span-4 rounded-xl border overflow-hidden flex flex-col ${theme.card}`}>
                    <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'} flex justify-between items-center`}>
                        <h3 className={`font-bold ${theme.textMain}`}>Fleet Manager</h3>
                        <input placeholder="Search..." className={`p-2 rounded text-xs w-1/2 font-mono ${theme.input}`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="overflow-y-auto flex-grow">
                        <table className="w-full text-sm text-left">
                            <thead className={`${theme.tableHead} text-xs uppercase sticky top-0 z-10`}><tr><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
                            <tbody className={theme.textMain}>
                                {jobs.filter(j => (j.regNo || '').includes(searchTerm.toUpperCase())).map(job => {
                                    const total = (Array.isArray(job.parts) ? job.parts.reduce((a,b)=>a+(Number(b.total)||0),0) : 0) + (Array.isArray(job.labor) ? job.labor.reduce((a,b)=>a+(Number(b.total)||0),0) : 0);
                                    return (
                                        <tr key={job.id} className={`border-b cursor-pointer transition-colors ${theme.tableRow} ${selectedJob?.id === job.id ? 'bg-blue-600/20 border-l-4 border-l-blue-500' : ''}`} onClick={() => setSelectedJob(job)}>
                                            <td className="px-4 py-3">
                                                <div className="font-bold font-mono">{job.regNo}</div>
                                                <div className={`text-[10px] ${theme.textSub}`}>{job.model} • {job.customerName}</div>
                                            </td>
                                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${job.status === 'READY' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>{job.status}</span></td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-xs">₹{total.toLocaleString()}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* DETAIL PANEL - THE GLORY DOSSIER */}
                <div className={`col-span-12 lg:col-span-8 rounded-xl border flex flex-col shadow-2xl ${theme.card}`}>
                    {selectedJob ? (
                        <>
                            <div className={`p-6 border-b ${darkMode ? 'border-slate-700 bg-[#0f172a]' : 'border-slate-200 bg-white'} flex justify-between items-start`}>
                                <div>
                                    <h1 className="text-4xl font-black font-mono tracking-tight text-blue-500">{selectedJob.regNo}</h1>
                                    <div className="flex gap-3 mt-2 text-sm font-bold opacity-80">
                                        <span>{selectedJob.model}</span>
                                        <span>•</span>
                                        <span>{selectedJob.variant}</span>
                                        <span>•</span>
                                        <span className="bg-slate-700 px-2 rounded text-xs py-0.5">{selectedJob.fuelType}</span>
                                    </div>
                                    
                                    {/* 🆕 ADDED: THE TRACKING LINK BOX (Visible ID for you) */}
                                    <div className="mt-4 flex items-center gap-2 bg-slate-800/50 p-2 rounded border border-slate-700 w-fit">
                                        <div className="text-[10px] uppercase text-slate-500 font-bold">Job ID:</div>
                                        <code className="text-xs font-mono text-green-400">{selectedJob.id}</code>
                                        <button onClick={() => copyToClipboard(`https://${window.location.host}/track/${selectedJob.id}`)} className="ml-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-lg">
                                            🔗 COPY LINK FOR WHATSAPP
                                        </button>
                                    </div>

                                </div>
                                <div className="text-right">
                                    <div className={`text-xs font-bold uppercase mb-1 ${theme.textSub}`}>Current Status</div>
                                    <div className={`text-lg font-black px-3 py-1 rounded border ${selectedJob.status === 'READY' ? 'border-green-500 text-green-500 bg-green-900/10' : 'border-blue-500 text-blue-500 bg-blue-900/10'}`}>{selectedJob.status}</div>
                                    <div className="mt-2">
                                        <button onClick={() => router.push(`/bill/${selectedJob.id}`)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold text-xs shadow-lg">📄 VIEW INVOICE</button>
                                        <button onClick={(e) => {if(confirm("Delete Job Permanently?")) deleteDoc(doc(db, "jobs", selectedJob.id))}} className="ml-2 bg-red-900/30 text-red-500 border border-red-900 hover:bg-red-900 hover:text-white px-4 py-2 rounded font-bold text-xs">🗑️ DELETE</button>
                                    </div>
                                </div>
                            </div>

                            <div className={`flex border-b ${darkMode ? 'border-slate-700 bg-[#1e293b]' : 'border-slate-200 bg-slate-50'}`}>
                                {['INFO', 'TASKS', 'FINANCE', 'LOGS'].map(tab => (
                                    <button key={tab} onClick={() => setJobDetailTab(tab)} className={`flex-1 py-3 text-xs font-bold tracking-widest border-b-2 transition-all ${jobDetailTab === tab ? 'border-blue-500 text-blue-500 bg-blue-500/5' : 'border-transparent ' + theme.textSub}`}>{tab}</button>
                                ))}
                            </div>

                            <div className="flex-grow overflow-y-auto p-6">
                                {jobDetailTab === 'INFO' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                <h4 className="text-xs font-bold uppercase text-blue-500 mb-4">👤 Customer Profile</h4>
                                                <div className="space-y-2 text-sm text-gray-300">
                                                    <div className="flex justify-between"><span>Name:</span> <span className="font-bold text-white">{selectedJob.customerName}</span></div>
                                                    <div className="flex justify-between"><span>Phone:</span> <span className="font-mono">{selectedJob.customerPhone}</span></div>
                                                    <div className="flex justify-between"><span>Billing:</span> <span>{selectedJob.billingName || '-'}</span></div>
                                                    <div className="flex justify-between"><span>GSTIN:</span> <span className="font-mono">{selectedJob.gstin || '-'}</span></div>
                                                </div>
                                            </div>
                                            <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                <h4 className="text-xs font-bold uppercase text-purple-500 mb-4">🚗 Technical DNA</h4>
                                                <div className="space-y-2 text-sm text-gray-300">
                                                    <div className="flex justify-between"><span>VIN:</span> <span className="font-mono text-xs">{selectedJob.vin || 'N/A'}</span></div>
                                                    <div className="flex justify-between"><span>Engine:</span> <span className="font-mono text-xs">{selectedJob.engineNo || 'N/A'}</span></div>
                                                    <div className="flex justify-between"><span>Odometer:</span> <span className="font-bold text-white">{selectedJob.odometer} km</span></div>
                                                    <div className="flex justify-between"><span>Color:</span> <span>{selectedJob.color}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                            <h4 className="text-xs font-bold uppercase text-yellow-500 mb-2">🕵️‍♂️ Supervisor Observations</h4>
                                            <p className="text-sm opacity-80 italic">"{selectedJob.supervisorObs || 'No notes recorded.'}"</p>
                                            
                                            {selectedJob.futureAdvisory?.length > 0 && (
                                                <div className="mt-4 p-4 border border-purple-500/30 bg-purple-900/10 rounded">
                                                    <h5 className="font-bold text-purple-400 text-xs uppercase mb-2">🔮 Future Recommendations</h5>
                                                    {selectedJob.futureAdvisory.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-xs border-b border-purple-500/20 py-1">
                                                            <span>{item.item}</span>
                                                            <span className="opacity-70">{item.dueIn}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {jobDetailTab === 'TASKS' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-sm">Technician: <span className="text-blue-400">{selectedJob.technicianName}</span></h4>
                                        </div>
                                        {selectedJob.blocks?.map((block, i) => (
                                            <div key={i} className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                <h5 className="font-bold text-xs uppercase mb-3 text-slate-500">{block.name}</h5>
                                                <div className="space-y-2">
                                                    {block.steps.map((step, k) => (
                                                        <div key={k} className="flex items-center gap-3 text-sm">
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${step.includes('✅') ? 'bg-green-500 border-green-500 text-black' : 'border-slate-500'}`}>{step.includes('✅') && '✓'}</div>
                                                            <span className={step.includes('✅') ? 'opacity-50 line-through' : ''}>{step.replace(' ✅','')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        {selectedJob.obdScanReport && (
                                            <div className="p-4 rounded-lg border border-red-900/50 bg-red-900/10">
                                                <h5 className="font-bold text-xs uppercase mb-2 text-red-400">OBD Codes Detected</h5>
                                                <p className="font-mono text-sm">{selectedJob.obdScanReport}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {jobDetailTab === 'FINANCE' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 border-b border-slate-700 pb-1">Parts Used</h4>
                                                <div className="space-y-1">
                                                    {selectedJob.parts?.map((p, i) => (
                                                        <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-800/50">
                                                            <span>{p.desc} <span className="text-[10px] opacity-50">x{p.qty}</span></span>
                                                            <span className="font-mono">₹{p.total}</span>
                                                        </div>
                                                    ))}
                                                    {(!selectedJob.parts || selectedJob.parts.length === 0) && <p className="text-xs italic opacity-50">No parts billed.</p>}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 border-b border-slate-700 pb-1">Labor Charges</h4>
                                                <div className="space-y-1">
                                                    {selectedJob.labor?.map((l, i) => (
                                                        <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-800/50">
                                                            <span>{l.desc}</span>
                                                            <span className="font-mono">₹{l.total}</span>
                                                        </div>
                                                    ))}
                                                    {(!selectedJob.labor || selectedJob.labor.length === 0) && <p className="text-xs italic opacity-50">No labor billed.</p>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`p-4 rounded-lg mt-4 flex justify-between items-center ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                                            <span className="text-sm font-bold">GRAND TOTAL</span>
                                            <span className="text-2xl font-black text-green-500">₹{((selectedJob.parts?.reduce((a,b)=>a+(Number(b.total)||0),0) || 0) + (selectedJob.labor?.reduce((a,b)=>a+(Number(b.total)||0),0) || 0)).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}

                                {jobDetailTab === 'LOGS' && (
                                    <div className="space-y-4">
                                        <div className="relative border-l-2 border-slate-700 ml-2 space-y-6 pl-4 py-2">
                                            {selectedJob.statusLogs?.map((log, i) => (
                                                <div key={i} className="relative">
                                                    <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full ${log.status === 'PAUSED' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                                    <p className="text-xs font-mono opacity-50">{new Date(log.time).toLocaleString()}</p>
                                                    <p className="font-bold text-sm">{log.status}</p>
                                                    {log.reason && <p className="text-xs text-red-400 italic">Reason: {log.reason}</p>}
                                                </div>
                                            ))}
                                            <div className="relative">
                                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500"></div>
                                                <p className="text-xs font-mono opacity-50">{new Date(selectedJob.createdAt?.seconds * 1000).toLocaleString()}</p>
                                                <p className="font-bold text-sm">JOB CREATED</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : <div className="flex items-center justify-center h-full opacity-30 text-xl font-bold">SELECT A JOB</div>}
                </div>
            </div>
        )}

        {/* ================= TAB 4: INVENTORY (FULL) ================= */}
        {activeTab === 'INVENTORY' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`p-6 rounded-xl shadow h-fit ${theme.card}`}>
                    <h3 className={`font-bold text-lg mb-4 ${theme.textMain}`}>Add Part</h3>
                    <div className="space-y-3">
                        <input className={`w-full border p-2 rounded ${theme.input}`} placeholder="Part Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                        <div className="flex gap-2"><input className={`w-1/2 border p-2 rounded ${theme.input}`} type="number" placeholder="Price" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} /><input className={`w-1/2 border p-2 rounded ${theme.input}`} type="number" placeholder="Stock" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} /></div>
                        <button onClick={handleAddItem} className="w-full bg-orange-600 text-white font-bold py-2 rounded hover:bg-orange-500">ADD STOCK</button>
                    </div>
                </div>
                <div className={`col-span-2 rounded-xl shadow overflow-hidden ${theme.card}`}>
                    <table className="w-full text-sm text-left"><thead className={theme.tableHead}><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Price</th><th className="px-4 py-2">Stock</th><th className="px-4 py-2">Action</th></tr></thead><tbody className={theme.textMain}>{inventory.map(i => (<tr key={i.id} className={`border-b ${theme.tableRow}`}><td className="px-4 py-2 font-bold">{i.name}</td><td className="px-4 py-2">₹{i.price}</td><td className="px-4 py-2">{i.stock}</td><td className="px-4 py-2"><button onClick={()=>handleDeleteItem(i.id)} className="text-red-500">×</button></td></tr>))}</tbody></table>
                </div>
            </div>
        )}

        {/* ================= TAB 5: USERS (FULL) ================= */}
        {activeTab === 'USERS' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`p-6 rounded-xl shadow h-fit border-l-4 border-red-500 ${theme.card}`}>
                    <h3 className={`font-bold text-lg mb-4 ${theme.textMain}`}>Create Staff</h3>
                    <div className="space-y-3">
                        <input className={`w-full border p-2 rounded ${theme.input}`} placeholder="Staff Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                        <input className={`w-full border p-2 rounded ${theme.input}`} placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        <select className={`w-full border p-2 rounded ${theme.input}`} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}><option value="technician">Technician</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select>
                        <button onClick={handleCreateUser} className="w-full bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700">GRANT ACCESS</button>
                    </div>
                </div>
                <div className={`col-span-2 rounded-xl shadow overflow-hidden ${theme.card}`}>
                    <h3 className={`p-4 font-bold border-b ${theme.textMain} ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>Active Users</h3>
                    <table className="w-full text-sm text-left"><thead className={theme.tableHead}><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Action</th></tr></thead><tbody className={theme.textMain}>{usersList.map(u => (<tr key={u.id} className={`border-b ${theme.tableRow}`}><td className="px-4 py-2 font-bold">{u.name}</td><td className="px-4 py-2 uppercase text-xs font-bold text-blue-500">{u.role}</td><td className={`px-4 py-2 ${theme.textSub}`}>{u.email}</td><td className="px-4 py-2"><button onClick={()=>handleDeleteUser(u.id)} className="text-red-500 font-bold">REVOKE</button></td></tr>))}</tbody></table>
                </div>
            </div>
        )}

        {/* ================= TAB 6: REPORTS (AUDIT & DOWNLOADS) ================= */}
        {activeTab === 'REPORTS' && (
            <div className="space-y-6 animate-in fade-in">
                <div className={`p-8 rounded-xl border text-center ${theme.card}`}>
                    <h2 className={`text-2xl font-bold mb-2 ${theme.textMain}`}>📊 Audit & Accounting Center</h2>
                    <p className={`mb-6 ${theme.textSub}`}>Export comprehensive job history for external accounting (Tally, Zoho, Excel).</p>
                    <div className="flex justify-center gap-4 flex-wrap">
                        <button onClick={() => downloadReport('CSV')} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl">📥 DOWNLOAD CSV</button>
                        <button onClick={() => downloadReport('PDF')} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl">🖨️ PRINT PDF</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`p-6 rounded-xl border ${theme.card}`}>
                        <h3 className={`text-sm font-bold uppercase mb-4 ${theme.textSub}`}>Revenue Split (Parts vs Labor)</h3>
                        <div className="flex items-end gap-4 h-40">
                            <div className="w-1/2 bg-blue-600 rounded-t flex flex-col justify-end text-center text-white pb-2" style={{height: '100%'}}><span className="font-bold">₹{financials.totalLabor.toLocaleString()}</span><span className="text-xs opacity-70">LABOR</span></div>
                            <div className="w-1/2 bg-orange-500 rounded-t flex flex-col justify-end text-center text-white pb-2" style={{height: `${(financials.totalParts / financials.totalRevenue)*100}%`}}><span className="font-bold">₹{financials.totalParts.toLocaleString()}</span><span className="text-xs opacity-70">PARTS</span></div>
                        </div>
                    </div>
                    <div className={`p-6 rounded-xl border ${theme.card}`}>
                        <h3 className={`text-sm font-bold uppercase mb-4 ${theme.textSub}`}>Job Status Flow</h3>
                        <div className="space-y-3">
                            {['ESTIMATE', 'WORK_IN_PROGRESS', 'READY', 'DELIVERED'].map(status => {
                                const count = jobs.filter(j => j.status === status).length;
                                return (<div key={status} className="flex items-center gap-2"><div className={`w-32 text-xs font-bold ${theme.textMain}`}>{status}</div><div className="flex-grow bg-slate-700 rounded-full h-2 overflow-hidden"><div className="bg-green-500 h-full" style={{width: `${(count/jobs.length)*100}%`}}></div></div><div className={`w-8 text-xs font-mono ${theme.textMain}`}>{count}</div></div>)
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}