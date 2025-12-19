"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation'; // To read the ID from URL
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

// 🏢 WORKSHOP CONFIGURATION (Change these to your real details)
const SHOP_CONFIG = {
  name: "CHENNAI CAR CARE",
  address: "SARASWATHI NAGAR, THIRUMULLAIVOIL, CHENNAI - 600062",
  phone: "+91 97907 46669",
  email: "chennaicarcare@outlook.com",
  gstin: "SAMPLE1234F1Z5", // Your GST Number
  upiId: "your-upi-id@okhdfcbank", // Your UPI ID for QR Code
  bankName: "SAMPLE Bank",
  accountNo: "SAMPLE123456789",
  ifsc: "HSAMPLE0001234"
};

export default function BillPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  // FETCH JOB DATA
  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      const docRef = doc(db, "jobs", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setJob({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("Job not found!");
      }
      setLoading(false);
    };
    fetchJob();
  }, [id]);

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center text-black font-bold">📄 Generating Invoice...</div>;
  if (!job) return <div className="text-center p-10 text-red-500">Invoice not found.</div>;

  // 🧮 CALCULATION ENGINE
  const partTotal = job.parts?.reduce((a, b) => a + Number(b.total), 0) || 0;
  const laborTotal = job.labor?.reduce((a, b) => a + Number(b.total), 0) || 0;
  const subTotal = partTotal + laborTotal;
  
  // GST LOGIC (Assuming 18% Standard for Auto Services)
  const gstRate = 18;
  const sgstAmount = subTotal * 0.09; // 9%
  const cgstAmount = subTotal * 0.09; // 9%
  const grandTotal = Math.round(subTotal + sgstAmount + cgstAmount);

  // 📅 DATE FORMATTER
  const invoiceDate = job.createdAt 
    ? new Date(job.createdAt.seconds * 1000).toLocaleDateString("en-GB") 
    : new Date().toLocaleDateString("en-GB");

  // 📤 ACTIONS
  const handlePrint = () => window.print();
  
  const sendWhatsApp = () => {
    const msg = `*INVOICE: ${job.regNo}*\nTotal Amount: ₹${grandTotal}\nPayable via GPay/PhonePe.\nThank you for visiting ${SHOP_CONFIG.name}!`;
    window.open(`https://wa.me/91${job.customerPhone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white text-black font-sans">
      
      {/* --- CONTROL BAR (Hidden on Print) --- */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <h1 className="text-xl font-bold text-gray-700">INVOICE PREVIEW</h1>
        <div className="flex gap-4">
           <button onClick={sendWhatsApp} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold shadow">WhatsApp PDF</button>
           <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold shadow">🖨️ PRINT INVOICE</button>
        </div>
      </div>

      {/* --- THE INVOICE PAPER (A4 Look) --- */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none p-8 md:p-12 print:p-0 min-h-[297mm]">
        
        {/* 1. HEADER */}
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
           <div>
              <h1 className="text-3xl font-black tracking-tight text-blue-900">{SHOP_CONFIG.name}</h1>
              <p className="text-sm font-medium mt-1 w-2/3 text-gray-600">{SHOP_CONFIG.address}</p>
              <p className="text-sm font-bold mt-2">GSTIN: {SHOP_CONFIG.gstin}</p>
              <p className="text-sm">Phone: {SHOP_CONFIG.phone}</p>
           </div>
           <div className="text-right">
              <h2 className="text-4xl font-black text-gray-200 uppercase">Tax Invoice</h2>
              <p className="text-lg font-bold mt-2">INV-{job.regNo.replace(/\s/g, '')}-{job.id.slice(-4)}</p>
              <p className="text-sm font-medium text-gray-500">Date: {invoiceDate}</p>
           </div>
        </div>

        {/* 2. BILL TO & VEHICLE INFO */}
        <div className="grid grid-cols-2 gap-8 mb-8">
           <div className="bg-gray-50 p-4 rounded border border-gray-200 print:border-none print:bg-transparent print:p-0">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Bill To Customer</h3>
              <p className="text-lg font-bold">{job.billingName || job.customerName}</p>
              <p className="text-sm text-gray-600">{job.customerPhone}</p>
              {job.gstin && <p className="text-sm text-gray-600 font-bold">GST: {job.gstin}</p>}
           </div>
           <div className="bg-gray-50 p-4 rounded border border-gray-200 print:border-none print:bg-transparent print:p-0">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Vehicle Details</h3>
              <div className="grid grid-cols-2 text-sm">
                <span className="font-bold">Reg No:</span> <span>{job.regNo}</span>
                <span className="font-bold">Model:</span> <span>{job.model} ({job.fuelType})</span>
                <span className="font-bold">Odometer:</span> <span>{job.odometer} KM</span>
                <span className="font-bold">Job Type:</span> <span>{job.serviceType}</span>
              </div>
           </div>
        </div>

        {/* 3. ITEMIZED TABLE */}
        <table className="w-full text-sm mb-8">
           <thead>
              <tr className="bg-blue-900 text-white print:bg-gray-200 print:text-black">
                 <th className="p-3 text-left w-12">#</th>
                 <th className="p-3 text-left">Description</th>
                 <th className="p-3 text-center">HSN/SAC</th>
                 <th className="p-3 text-center">Qty</th>
                 <th className="p-3 text-right">Rate</th>
                 <th className="p-3 text-right">Total</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-gray-300">
              {/* PARTS LOOP */}
              {job.parts?.map((item, i) => (
                 <tr key={`p-${i}`}>
                    <td className="p-3 text-gray-500">{i + 1}</td>
                    <td className="p-3 font-medium">{item.desc}</td>
                    <td className="p-3 text-center text-gray-500">8708</td>
                    <td className="p-3 text-center">{item.qty}</td>
                    <td className="p-3 text-right">₹{item.price}</td>
                    <td className="p-3 text-right font-bold">₹{item.total}</td>
                 </tr>
              ))}
              {/* LABOR LOOP */}
              {job.labor?.map((item, i) => (
                 <tr key={`l-${i}`}>
                    <td className="p-3 text-gray-500">{job.parts?.length + i + 1}</td>
                    <td className="p-3 font-medium">{item.desc} <span className="text-xs text-gray-400 italic">(Labor)</span></td>
                    <td className="p-3 text-center text-gray-500">9987</td>
                    <td className="p-3 text-center">-</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right font-bold">₹{item.total}</td>
                 </tr>
              ))}
           </tbody>
        </table>

        {/* 4. TOTALS & TAX BREAKDOWN */}
        <div className="flex justify-end mb-10">
           <div className="w-1/2 md:w-1/3 space-y-2">
              <div className="flex justify-between text-sm">
                 <span className="text-gray-600">Taxable Amount</span>
                 <span className="font-bold">₹{subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                 <span className="text-gray-600">Add: CGST (9%)</span>
                 <span>₹{cgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                 <span className="text-gray-600">Add: SGST (9%)</span>
                 <span>₹{sgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-black bg-gray-100 p-2 border-t-2 border-black">
                 <span>GRAND TOTAL</span>
                 <span>₹{grandTotal.toLocaleString()}</span>
              </div>
              <div className="text-xs text-right text-gray-500 italic">
                 (Amount in words: Rupees {grandTotal} Only)
              </div>
           </div>
        </div>

        {/* 5. FOOTER: BANK & QR CODE */}
        <div className="grid grid-cols-3 gap-8 border-t-2 border-black pt-6">
           
           {/* BANK DETAILS */}
           <div className="col-span-1 text-xs space-y-1">
              <h4 className="font-bold uppercase mb-2">Bank Details</h4>
              <p>Bank: {SHOP_CONFIG.bankName}</p>
              <p>A/c No: {SHOP_CONFIG.accountNo}</p>
              <p>IFSC: {SHOP_CONFIG.ifsc}</p>
              <p className="mt-4 font-bold">Terms & Conditions:</p>
              <ul className="list-disc pl-4 text-[10px] text-gray-500">
                 <li>Goods once sold will not be taken back.</li>
                 <li>Warranty on parts as per manufacturer policy.</li>
                 <li>Subject to City Jurisdiction only.</li>
              </ul>
           </div>

           {/* QR CODE (Dynamic) */}
           <div className="col-span-1 flex flex-col items-center">
              <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${SHOP_CONFIG.upiId}&pn=${encodeURIComponent(SHOP_CONFIG.name)}&am=${grandTotal}&tn=Invoice${job.regNo}`} 
                 alt="UPI QR"
                 className="w-24 h-24 border-2 border-black p-1"
              />
              <p className="text-[10px] font-bold mt-2">Scan to Pay via UPI</p>
           </div>

           {/* SIGNATURE */}
           <div className="col-span-1 text-right flex flex-col justify-end">
              <div className="h-16"></div>
              <p className="font-bold">{SHOP_CONFIG.name}</p>
              <p className="text-[10px] text-gray-500">(Authorized Signatory)</p>
           </div>
        </div>

      </div>
    </div>
  );
}