"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase'; 

// 🏦 YOUR PAYMENT DETAILS
const WORKSHOP_UPI_ID = "shop@upi"; 
const WORKSHOP_NAME = "AutoFix Center";

export default function InvoicePage() {
  const { id } = useParams(); 
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. FETCH DATA SAFELY
  useEffect(() => {
    if (!id) return;
    const fetchJob = async () => {
      try {
        const docRef = doc(db, "jobs", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setJob({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert("Job not found!");
        }
      } catch (error) {
        console.error("Error fetching invoice:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">📄 Generating Tax Invoice...</div>;
  if (!job) return <div className="min-h-screen flex items-center justify-center text-red-500">❌ Invoice Not Found</div>;

  // 2. FINANCIAL CALCULATIONS
  const partsTotal = job.parts?.reduce((sum, item) => sum + (Number(item.total) || 0), 0) || 0;
  const laborTotal = job.labor?.reduce((sum, item) => sum + (Number(item.total) || 0), 0) || 0;
  
  const TAX_RATE = 0.18; 
  const subTotal = partsTotal + laborTotal;
  const sgst = subTotal * (TAX_RATE / 2); 
  const cgst = subTotal * (TAX_RATE / 2); 
  const grandTotal = Math.round(subTotal + sgst + cgst);

  // 3. PREDICTIVE SERVICE CALCULATIONS (The New Feature) 🧠
  const currentOdo = Number(job.odometer) || 0;
  const nextServiceKm = currentOdo + 10000;
  
  const nextServiceDate = new Date();
  nextServiceDate.setMonth(nextServiceDate.getMonth() + 6);
  const nextServiceDateString = nextServiceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // 4. QR CODE GENERATION
  const upiString = `upi://pay?pa=${WORKSHOP_UPI_ID}&pn=${encodeURIComponent(WORKSHOP_NAME)}&am=${grandTotal}&tn=Inv-${job.regNo}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiString)}`;

  // 5. SHARE
  const shareInvoice = () => {
    const msg = `*🧾 INVOICE - ${WORKSHOP_NAME}*\n\n*Customer:* ${job.customerName}\n*Vehicle:* ${job.model} (${job.regNo})\n\n*Bill Summary:*\nParts: ₹${partsTotal}\nLabor: ₹${laborTotal}\nTax (18%): ₹${(sgst + cgst).toFixed(2)}\n*TOTAL: ₹${grandTotal}*\n\n*Next Service Due:*\n📅 ${nextServiceDateString} OR 🚗 ${nextServiceKm} KM\n\nPay via UPI: ${WORKSHOP_UPI_ID}`;
    window.open(`https://wa.me/91${job.customerPhone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const printInvoice = () => window.print();

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black font-sans">
      
      {/* CONTROLS */}
      <div className="max-w-4xl mx-auto mb-6 flex gap-4 print:hidden">
        <button onClick={printInvoice} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded shadow-lg flex items-center justify-center gap-2"><span>🖨️</span> PRINT</button>
        <button onClick={shareInvoice} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded shadow-lg flex items-center justify-center gap-2"><span>📲</span> WHATSAPP</button>
      </div>

      {/* INVOICE SHEET */}
      <div className="max-w-4xl mx-auto bg-white shadow-2xl p-8 md:p-12 min-h-[1000px] print:shadow-none print:p-0 relative">
        
        {/* HEADER */}
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
           <div>
              <h1 className="text-4xl font-black tracking-tighter text-blue-900">AUTO<span className="text-black">FIX</span> <span className="text-xs text-gray-500 font-normal block mt-1">PREMIUM CAR CARE CENTER</span></h1>
              <p className="text-sm text-gray-600 mt-2 max-w-xs">Plot No. 123, Auto Nagar, Hyderabad, India - 500001</p>
              <p className="text-sm text-gray-600">📞 +91 98765 43210 | 📧 support@autofix.com</p>
           </div>
           <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-400">TAX INVOICE</h2>
              <p className="font-mono text-lg font-bold">#{job.id.slice(-6).toUpperCase()}</p>
              <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p>
              <p className="text-sm font-bold mt-2">GSTIN: 36ABCDE1234F1Z5</p>
           </div>
        </div>

        {/* INFO GRID */}
        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
           <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <h3 className="font-bold uppercase text-gray-500 mb-2 text-xs">Billed To</h3>
              <p className="font-bold text-lg">{job.billingName || job.customerName}</p>
              <p>{job.customerPhone}</p>
              {job.gstin && <p className="font-mono mt-1 text-xs">GSTIN: {job.gstin}</p>}
           </div>
           <div className="bg-gray-50 p-4 rounded border border-gray-200 text-right">
              <h3 className="font-bold uppercase text-gray-500 mb-2 text-xs">Vehicle Details</h3>
              <p className="font-bold text-lg">{job.regNo}</p>
              <p>{job.model} {job.color ? `- ${job.color}` : ''}</p>
              <p className="text-gray-500">{job.fuelType} | {job.odometer} KM</p>
              {job.vin && <p className="font-mono text-xs mt-1">VIN: {job.vin}</p>}
           </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="border-t-2 border-black mb-2"></div>
        <div className="grid grid-cols-12 font-bold text-xs uppercase text-gray-600 py-2 border-b border-gray-300">
           <div className="col-span-1">#</div>
           <div className="col-span-5">Description</div>
           <div className="col-span-2 text-center">HSN/SAC</div>
           <div className="col-span-1 text-center">Qty</div>
           <div className="col-span-1 text-right">Rate</div>
           <div className="col-span-2 text-right">Amount</div>
        </div>

        <div className="min-h-[300px]">
           {job.parts?.map((item, i) => (
             <div key={`p-${i}`} className="grid grid-cols-12 text-sm py-2 border-b border-gray-100 items-center">
                <div className="col-span-1 text-gray-400">{i+1}</div>
                <div className="col-span-5 font-bold">{item.desc}</div>
                <div className="col-span-2 text-center text-gray-400">8708</div>
                <div className="col-span-1 text-center">{item.qty}</div>
                <div className="col-span-1 text-right">{item.price}</div>
                <div className="col-span-2 text-right font-bold">{item.total}</div>
             </div>
           ))}
           {job.labor?.map((item, i) => (
             <div key={`l-${i}`} className="grid grid-cols-12 text-sm py-2 border-b border-gray-100 items-center">
                <div className="col-span-1 text-gray-400">L-{i+1}</div>
                <div className="col-span-5">{item.desc} (Labor)</div>
                <div className="col-span-2 text-center text-gray-400">9987</div>
                <div className="col-span-1 text-center">-</div>
                <div className="col-span-1 text-right">{item.price}</div>
                <div className="col-span-2 text-right font-bold">{item.total}</div>
             </div>
           ))}
        </div>

        {/* TOTALS & FOOTER */}
        <div className="flex justify-between mt-6 border-t border-black pt-6">
           
           {/* LEFT: PAYMENT QR & NEXT SERVICE */}
           <div className="w-1/2 flex gap-6">
              <div className="border-2 border-black p-1 inline-block h-fit">
                  <img src={qrCodeUrl} alt="Payment QR" className="w-24 h-24" />
                  <p className="text-[10px] text-center font-bold mt-1">SCAN TO PAY</p>
              </div>
              
              {/* 🆕 NEXT SERVICE ADVICE */}
              <div className="flex flex-col justify-between py-1">
                  <div>
                      <h4 className="font-bold text-xs uppercase text-gray-500 mb-1">Bank Details</h4>
                      <p className="text-xs font-bold">UPI: {WORKSHOP_UPI_ID}</p>
                      <p className="text-[10px] text-gray-500">GPay / PhonePe / Paytm</p>
                  </div>
                  
                  <div className="border border-blue-200 bg-blue-50 p-2 rounded mt-2">
                      <h4 className="font-bold text-xs uppercase text-blue-800 mb-1">Next Service Due</h4>
                      <div className="flex gap-4 text-sm font-bold text-blue-900">
                          <span>📅 {nextServiceDateString}</span>
                          <span className="text-gray-400">|</span>
                          <span>🚗 {nextServiceKm} KM</span>
                      </div>
                  </div>
              </div>
           </div>

           {/* RIGHT: MATH */}
           <div className="w-1/3 space-y-3 text-right">
              <div className="flex justify-between text-sm"><span>Sub Total:</span><span className="font-bold">₹{subTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm text-gray-500"><span>CGST (9%):</span><span>₹{cgst.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm text-gray-500"><span>SGST (9%):</span><span>₹{sgst.toFixed(2)}</span></div>
              <div className="border-t-2 border-black pt-3 flex justify-between text-2xl font-black text-blue-900 bg-blue-50 p-2 rounded">
                 <span>TOTAL:</span>
                 <span>₹{grandTotal.toFixed(2)}</span>
              </div>
           </div>
        </div>

        {/* SIGNATURES */}
        <div className="flex justify-between items-end mt-16 text-sm">
           <div className="text-center">
              <p className="font-bold mb-8">Customer Signature</p>
           </div>
           <div className="text-center">
              <p className="font-bold text-blue-900">For {WORKSHOP_NAME}</p>
              <div className="h-10"></div>
              <p className="text-xs text-gray-500">Authorized Signatory</p>
           </div>
        </div>
        
        <div className="absolute bottom-4 left-0 w-full text-center text-[10px] text-gray-400">
           Thank you for choosing AutoFix! • Safe Driving.
        </div>

      </div>
    </div>
  );
}