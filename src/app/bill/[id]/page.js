"use client";
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase'; // Keeping the 3-level depth fix
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function MasterInvoice() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!id) return;
    const fetchJob = async () => {
      try {
        const docRef = doc(db, "jobs", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setJob({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center font-bold text-slate-500">Loading Job Card...</div>;
  if (!job) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-red-500">Invoice Not Found</div>;

  // --- FINANCIAL ENGINE ---
  // 1. Parts (Inventory Items)
  const parts = job.parts || [];
  const partsTotal = parts.reduce((acc, item) => acc + (Number(item.total) || 0), 0);

  // 2. Labor & Repairs (Service Charges)
  const labor = job.labor || [];
  const laborTotal = labor.reduce((acc, item) => acc + (Number(item.total) || 0), 0);

  // 3. Additional Expenses (Fuel, Lathe, Outsource)
  const expenses = job.expenses || [];
  const expenseTotal = expenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  // 4. Totals
  const subTotal = partsTotal + laborTotal + expenseTotal;
  const gstRate = 0.18; // 18% Standard GST
  const gstAmount = subTotal * gstRate;
  const grandTotal = subTotal + gstAmount;

  // --- DATE FORMATTER ---
  const formatDate = (timestamp) => {
    if (!timestamp) return new Date().toLocaleDateString('en-IN');
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans p-4 md:p-8 print:p-0 print:bg-white">
      
      {/* NO-PRINT TOOLBAR */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Link href="/supervisor" className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors font-bold text-sm">
          <span>⬅</span> Back to Dashboard
        </Link>
        <div className="flex gap-3">
           <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95">
             <span>🖨️</span> Print Invoice
           </button>
        </div>
      </div>

      {/* === INVOICE DOCUMENT === */}
      <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-xl overflow-hidden print:shadow-none print:rounded-none">
        
        {/* 1. HEADER ROW */}
        <div className="p-8 border-b-4 border-slate-800 flex justify-between items-start">
           <div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900">JOBCARD<span className="text-blue-600">PRO</span></h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Automotive Service Center</p>
              
              <div className="mt-4 text-xs text-slate-500 space-y-1">
                 <p>📍 123, Mechanic Street, Auto City, India</p>
                 <p>📞 +91 98765 43210</p>
                 <p>✉️ support@jobcardpro.com</p>
                 <p>🆔 GSTIN: 29ABCDE1234F1Z5</p>
              </div>
           </div>

           <div className="text-right">
              <div className="text-2xl font-bold uppercase tracking-widest text-slate-700 mb-1">
                 {job.status === 'ESTIMATE' ? 'ESTIMATE' : 'TAX INVOICE'}
              </div>
              <div className="text-sm font-mono text-slate-500 mb-4">#{job.id.slice(0,8).toUpperCase()}</div>
              
              <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs text-left w-48">
                 <div className="flex justify-between mb-1"><span className="text-slate-500">Date:</span> <span className="font-bold">{formatDate(job.createdAt)}</span></div>
                 <div className="flex justify-between mb-1"><span className="text-slate-500">Advisor:</span> <span className="font-bold">{job.advisor || 'Admin'}</span></div>
                 <div className="flex justify-between"><span className="text-slate-500">Type:</span> <span className="font-bold text-blue-600">{job.serviceType || 'General'}</span></div>
              </div>
           </div>
        </div>

        {/* 2. INFO GRID (Customer & Vehicle) */}
        <div className="grid grid-cols-2 border-b border-slate-200">
           {/* CUSTOMER */}
           <div className="p-6 border-r border-slate-200">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">BILL TO</h3>
              <div className="text-sm">
                 <p className="font-bold text-lg text-slate-900">{job.billingName || job.customerName || 'Walk-in Customer'}</p>
                 <p className="text-slate-600 mt-1 whitespace-pre-line">{job.billingAddress || 'Address not provided'}</p>
                 <p className="text-slate-600 mt-1">📞 {job.customerPhone}</p>
                 {job.gstin && <p className="text-xs font-mono bg-blue-50 text-blue-700 inline-block px-2 py-1 rounded mt-2">GST: {job.gstin}</p>}
              </div>
           </div>

           {/* VEHICLE */}
           <div className="p-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">VEHICLE DETAILS</h3>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                 <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Registration</span>
                    <span className="font-bold font-mono text-lg">{job.regNo || job.vehicleNumber}</span>
                 </div>
                 <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Odometer</span>
                    <span className="font-bold">{job.odometer} KM</span>
                 </div>
                 <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Make / Model</span>
                    <span className="font-bold">{job.make} {job.model} {job.variant}</span>
                 </div>
                 <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Fuel / Battery</span>
                    <span className="font-bold">{job.fuelType} {job.batteryNo ? `/ ${job.batteryNo}` : ''}</span>
                 </div>
                 <div className="col-span-2">
                    <span className="block text-[10px] text-slate-400 uppercase">VIN / Chassis</span>
                    <span className="font-mono text-xs text-slate-600">{job.vin || 'N/A'}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* 3. FORENSIC REPORT (Visual Evidence) */}
        <div className="bg-slate-50 p-6 border-b border-slate-200 print:bg-white print:border-b-2 print:border-black">
           <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              🛡️ INTAKE CONDITION REPORT
           </h3>
           
           <div className="grid grid-cols-4 gap-6 text-xs">
              {/* Fuel */}
              <div className="bg-white border border-slate-200 p-3 rounded">
                 <div className="text-slate-400 font-bold mb-2">FUEL LEVEL</div>
                 <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                    <div className="bg-slate-800 h-full print:bg-black" style={{width: `${job.fuelLevel || 50}%`}}></div>
                 </div>
                 <div className="text-right mt-1 font-mono font-bold">{job.fuelLevel || 50}%</div>
              </div>

              {/* Inventory */}
              <div className="col-span-2 bg-white border border-slate-200 p-3 rounded">
                 <div className="text-slate-400 font-bold mb-2">INVENTORY CHECK</div>
                 <div className="flex flex-wrap gap-2">
                    {job.inventory && Object.entries(job.inventory).filter(([_, v]) => v).map(([k]) => (
                       <span key={k} className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded print:border-black">
                          ✓ {k.replace(/([A-Z])/g, ' $1').trim()}
                       </span>
                    ))}
                    {(!job.inventory || Object.values(job.inventory).every(v => !v)) && <span className="text-slate-400 italic">No items marked</span>}
                 </div>
              </div>

              {/* Damage Summary */}
              <div className="bg-white border border-slate-200 p-3 rounded">
                 <div className="text-slate-400 font-bold mb-2">DAMAGES & WARNINGS</div>
                 <div className="space-y-1">
                    <div className="flex justify-between">
                       <span>Body Panels</span>
                       <span className="font-bold text-red-600 print:text-black">{Object.keys(job.bodyDamages || {}).length} Marked</span>
                    </div>
                    <div className="flex justify-between">
                       <span>Lights On</span>
                       <span className="font-bold text-red-600 print:text-black">{Object.keys(job.warningLights || {}).filter(k => job.warningLights[k]).length} Active</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* 4. BILLING TABLES */}
        <div className="p-8">
           
           {/* A. PARTS TABLE */}
           {parts.length > 0 && (
             <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-900 uppercase mb-2 border-b-2 border-slate-800 pb-2">1. Parts Replaced</h3>
                <table className="w-full text-sm">
                   <thead>
                      <tr className="text-left text-slate-500">
                         <th className="py-2 font-medium">Description / Part No</th>
                         <th className="py-2 font-medium text-center w-20">Qty</th>
                         <th className="py-2 font-medium text-right w-32">Rate</th>
                         <th className="py-2 font-medium text-right w-32">Total</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {parts.map((p, i) => (
                         <tr key={i}>
                            <td className="py-2 text-slate-700">{p.desc}</td>
                            <td className="py-2 text-center text-slate-600">{p.qty}</td>
                            <td className="py-2 text-right text-slate-600">₹{p.price}</td>
                            <td className="py-2 text-right font-bold text-slate-900">₹{p.total}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}

           {/* B. LABOR TABLE */}
           {labor.length > 0 && (
             <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-900 uppercase mb-2 border-b-2 border-slate-800 pb-2">2. Labor, Repairs & Services</h3>
                <table className="w-full text-sm">
                   <thead>
                      <tr className="text-left text-slate-500">
                         <th className="py-2 font-medium">Service Description</th>
                         <th className="py-2 font-medium text-right w-32">Amount</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {labor.map((l, i) => (
                         <tr key={i}>
                            <td className="py-2 text-slate-700">{l.desc}</td>
                            <td className="py-2 text-right font-bold text-slate-900">₹{l.total}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}

           {/* C. EXPENSES TABLE (If applicable) */}
           {expenses.length > 0 && (
             <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-900 uppercase mb-2 border-b-2 border-slate-800 pb-2">3. Additional Charges</h3>
                <table className="w-full text-sm">
                   <tbody className="divide-y divide-slate-100">
                      {expenses.map((e, i) => (
                         <tr key={i}>
                            <td className="py-2 text-slate-700">{e.type} {e.desc ? `- ${e.desc}` : ''}</td>
                            <td className="py-2 text-right font-bold text-slate-900 w-32">₹{e.amount}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}

           {/* 5. SUMMARY & TOTALS */}
           <div className="flex justify-end mt-4">
              <div className="w-full md:w-1/3 bg-slate-50 p-6 rounded print:bg-white print:border print:border-slate-300">
                 <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                       <span>Total Parts</span>
                       <span>₹{partsTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                       <span>Total Labor</span>
                       <span>₹{laborTotal.toFixed(2)}</span>
                    </div>
                    {expenseTotal > 0 && (
                       <div className="flex justify-between text-slate-600">
                          <span>Addn. Expenses</span>
                          <span>₹{expenseTotal.toFixed(2)}</span>
                       </div>
                    )}
                    
                    <div className="border-t border-slate-300 my-2"></div>
                    
                    <div className="flex justify-between font-bold text-slate-800">
                       <span>SUBTOTAL</span>
                       <span>₹{subTotal.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-slate-600">
                       <span>GST ({gstRate * 100}%)</span>
                       <span>₹{gstAmount.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t-2 border-slate-800 my-2"></div>
                    
                    <div className="flex justify-between text-xl font-black text-slate-900">
                       <span>GRAND TOTAL</span>
                       <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* 6. FOOTER & DISCLAIMER */}
        <div className="bg-slate-50 p-8 border-t border-slate-200 print:bg-white print:border-t-2 print:border-black">
           <div className="grid grid-cols-2 gap-8 text-[10px] text-slate-500 uppercase tracking-wide">
              <div>
                 <p className="font-bold text-slate-900 mb-1">Terms & Conditions:</p>
                 <ul className="list-disc list-inside space-y-1">
                    <li>Goods once sold will not be taken back.</li>
                    <li>Warranty on parts as per manufacturer policy.</li>
                    <li>Interest @24% p.a. will be charged if not paid within 7 days.</li>
                    <li>Subject to local jurisdiction.</li>
                 </ul>
              </div>
              <div className="text-right flex flex-col justify-between">
                 <p>For JobCard Pro Service Center</p>
                 <div className="h-12"></div>
                 <p className="font-bold text-slate-900">Authorized Signatory</p>
              </div>
           </div>
           
           <div className="text-center mt-8 text-xs text-slate-400">
              Generated by JobCard Pro v12.0 • Digital Record • {new Date().toLocaleString()}
           </div>
        </div>

      </div>
    </div>
  );
}