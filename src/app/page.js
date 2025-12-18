import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans">
      
      {/* --- Branding Section --- */}
      <div className="text-center mb-16 animate-pulse">
        <h1 className="text-6xl font-extrabold text-blue-500 tracking-tighter mb-4">
          JobCard<span className="text-white">Pro</span>
        </h1>
        <p className="text-slate-400 text-xl tracking-widest uppercase">Workshop Operating System</p>
      </div>

      {/* --- Role Selection Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        
        {/* Card 1: Technician (Linked) */}
        <Link href="/technician" className="block w-full">
          <div className="group relative bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-green-500 transition-all duration-300 p-10 rounded-3xl cursor-pointer shadow-2xl h-full">
            <div className="absolute top-0 right-0 bg-slate-900 rounded-bl-2xl rounded-tr-2xl px-4 py-2 border-b border-l border-slate-700">
               <span className="text-xs text-slate-400 font-mono">RESTRICTED ACCESS</span>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-green-500/10 rounded-full text-4xl">🔧</div>
              <h2 className="text-3xl font-bold text-white">Technician</h2>
            </div>
            
            <p className="text-slate-400 text-lg leading-relaxed">
              Access your job queue.
              <br/>
              <span className="text-red-400 font-bold mt-2 block flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span> 
                Financial Data Hidden
              </span>
            </p>
          </div>
        </Link>

        {/* Card 2: Supervisor (Linked) */}
        <Link href="/supervisor" className="block w-full">
          <div className="group bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 transition-all duration-300 p-10 rounded-3xl cursor-pointer shadow-2xl h-full">
            <div className="flex items-center gap-4 mb-6">
               <div className="p-4 bg-blue-500/10 rounded-full text-4xl">👔</div>
              <h2 className="text-3xl font-bold text-white">Supervisor</h2>
            </div>
            <p className="text-slate-400 text-lg leading-relaxed">
              Create Job Cards, assign technicians, and manage workshop flow.
            </p>
          </div>
        </Link>

      </div>

      {/* --- Footer --- */}
      <div className="mt-20 flex flex-col items-center gap-2 text-slate-600">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-mono">SYSTEM ONLINE v1.0</span>
        </div>
      </div>
    </main>
  );
}