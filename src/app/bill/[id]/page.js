"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation'; // <--- NEW: The Safe Way
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import Link from 'next/link';

export default function BillPage() {
  const params = useParams(); // <--- Grab ID securely
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      // 1. Safety Check: If ID isn't ready yet, stop.
      if (!params?.id) return;

      try {
        const jobId = params.id; 
        const docRef = doc(db, "jobs", jobId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setJob(docSnap.data());
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error fetching bill:", error);
      }
      setLoading(false);
    };

    fetchJob();
  }, [params]); // Run this whenever params change

  if (loading) return <div className="p-10 text-white">Generating Invoice...</div>;
  if (!job) return <div className="p-10 text-white">Invoice Not Found.</div>;

  return (
    <div className="min-h-screen bg-gray-500 p-8 flex justify-center font-mono text-black">
      
      {/* THE A4 PAPER */}
      <div className="bg-white w-full max-w-2xl p-10 shadow-2xl rounded-sm min-h-[800px] flex flex-col">
        
        {/* Header */}
        <div className="border-b-4 border-black pb-8 mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black tracking-tighter">JobCard<span className="text-blue-600">Pro</span></h1>
            <p className="text-sm text-gray-500 mt-1">Premium Workshop Services</p>
            <p className="text-sm text-gray-500">Bangalore, KA - 560001</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold uppercase text-gray-400">Invoice</h2>
            <p className="font-bold">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Customer / Vehicle Info */}
        <div className="grid grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Billed To</h3>
            <p className="text-xl font-bold">{job.vehicleNumber}</p>
            <p className="text-gray-600">{job.model}</p>
          </div>
          <div className="text-right">
             <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Service Advisor</h3>
             <p>{job.technicianName || 'General Staff'}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="flex-grow">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2">Description of Work</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Item 1: The Main Work */}
              <tr className="border-b border-gray-200">
                <td className="py-4 pr-4 whitespace-pre-line">
                  <span className="font-bold block mb-1">General Service & Repairs</span>
                  <span className="text-sm text-gray-500">{job.complaints}</span>
                </td>
                <td className="py-4 text-right align-top">
                  ₹{job.estimatedCost || '0'}
                </td>
              </tr>
              {/* Item 2: Tax (Fake example) */}
              <tr className="border-b border-gray-200 text-gray-500">
                <td className="py-2">Service Charges / Tax (Included)</td>
                <td className="py-2 text-right">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer / Total */}
        <div className="border-t-4 border-black pt-4 mt-8">
          <div className="flex justify-between items-center text-3xl font-bold">
            <span>Total Payable</span>
            <span>₹{job.estimatedCost || '0'}</span>
          </div>
        </div>

        <div className="mt-16 text-center text-xs text-gray-400">
          <p>Thank you for your business!</p>
          <p>This is a computer-generated invoice.</p>
        </div>

        {/* CONTROLS (Hide when printing) */}
        <div className="mt-10 flex gap-4 justify-center print:hidden">
          <button 
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-500">
            🖨️ Print PDF
          </button>
          <Link href="/supervisor" className="bg-gray-200 text-black px-6 py-3 rounded-lg font-bold hover:bg-gray-300">
            Cancel
          </Link>
        </div>

      </div>
    </div>
  );
}