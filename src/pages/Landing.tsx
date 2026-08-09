import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, CalendarDays, Users, BellRing, ArrowRight,
  Shield, Activity, BookOpen, LayoutDashboard, Star
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-black font-sans overflow-x-hidden selection:bg-[#FFE600] selection:text-black">
      {/* Brutalist Dot Pattern Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="w-full h-full bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:24px_24px]" />
      </div>

      {/* Floating Brutalist Navbar */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'py-4' : 'py-8'} px-6 lg:px-12`}>
        <div className={`max-w-7xl mx-auto flex items-center justify-between transition-all duration-300 ${scrolled ? 'bg-white border-4 border-black p-3 shadow-[8px_8px_0_0_#000]' : 'p-0'}`}>
          <div className="flex items-center gap-3">
            {/* The Logo from user attachment. Make sure to save it as logo.png in the public folder */}
            <img 
              src="/logo.png" 
              alt="RemindrX" 
              className="h-10 sm:h-12 object-contain hover:-rotate-6 transition-transform duration-300"
              onError={(e) => {
                // Fallback if logo.png not added yet
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            {/* Fallback Text if logo image is missing */}
            <span className="hidden text-3xl font-black italic tracking-tighter uppercase text-black drop-shadow-[2px_2px_0_#FFE600]">
              REMINDR<span className="text-[#FFE600] drop-shadow-[2px_2px_0_#000]">X</span>
              <Star className="inline h-6 w-6 ml-1 text-[#FFE600] fill-[#FFE600] drop-shadow-[2px_2px_0_#000]" />
            </span>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:block text-base font-black text-black hover:text-[#FFE600] transition-colors uppercase tracking-widest stroke-text-sm"
              style={{ WebkitTextStroke: '0.5px black' }}
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/login')}
              className="group flex items-center gap-2 text-sm sm:text-base font-black uppercase tracking-widest bg-[#FFE600] text-black border-4 border-black px-6 py-3 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0_0_#000] shadow-[8px_8px_0_0_#000] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
            >
              Get Started <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-40 lg:pt-48">
        {/* Brutalist Hero Section */}
        <section className="px-6 relative text-center max-w-5xl mx-auto h-[80vh] min-h-[600px] flex flex-col justify-start sm:justify-center items-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white border-4 border-black shadow-[6px_6px_0_0_#000] mb-8 hover:-rotate-2 transition-transform">
            <div className="h-3 w-3 rounded-full bg-[#FFE600] border-2 border-black" />
            <span className="text-sm font-black uppercase tracking-widest text-black">The Ultimate Campus System</span>
          </div>

          <h1 className="text-6xl sm:text-[6rem] md:text-[8rem] font-black tracking-tighter leading-[0.9] mb-10 -rotate-2">
            ACADEMIC <br />
            <span className="bg-[#FFE600] px-4 border-4 border-black shadow-[8px_8px_0_0_#000] inline-block mt-4 -rotate-2 hover:rotate-2 transition-transform cursor-crosshair">
              CHAOS
            </span> <br />
            MASTERED.
          </h1>

          <p className="text-xl sm:text-2xl text-black/80 max-w-2xl mx-auto font-bold leading-relaxed mb-12 border-l-8 border-black pl-6 text-left transform rotate-1">
            Never miss a class, an assignment, or a sudden schedule change again. Organize your university life with raw efficiency.
          </p>

          <div className="flex w-full sm:w-auto items-center justify-center gap-4 sm:gap-6 flex-col sm:flex-row z-20">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto group px-10 py-5 bg-black text-white font-black uppercase tracking-widest text-base hover:-translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0_0_#FFE600] shadow-[8px_8px_0_0_#FFE600] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all border-4 border-black flex items-center justify-center gap-3"
            >
              Open App <Zap className="h-5 w-5 fill-[#FFE600] text-[#FFE600]" />
            </button>
            <button
              onClick={() => document.getElementById('bento')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto px-10 py-5 font-black uppercase tracking-widest text-base bg-white text-black hover:-translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0_0_#000] shadow-[8px_8px_0_0_#000] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all border-4 border-black flex items-center justify-center gap-2 group"
            >
              Learn More <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* Brutalist Marquee */}
        <div className="w-full bg-[#FFE600] border-y-8 border-black py-4 overflow-hidden relative rotate-1 scale-105 z-20">
          <div className="flex whitespace-nowrap animate-[marquee_20s_linear_infinite]">
            {[...Array(10)].map((_, i) => (
              <span key={i} className="text-2xl font-black uppercase mx-8 flex items-center gap-8">
                NO MORE EXCUSES <Star className="h-6 w-6 fill-black" />
                NEVER BE LATE <Star className="h-6 w-6 fill-black" />
                STAY UPDATED <Star className="h-6 w-6 fill-black" />
              </span>
            ))}
          </div>
        </div>

        {/* Abstract Brutalist Dashboard Preview */}
        <section className="relative w-full max-w-[80rem] mx-auto mt-20 px-6 lg:px-12 z-10">
          <div className="w-full bg-white border-8 border-black shadow-[20px_20px_0_0_#000] overflow-hidden group">
            {/* Top Bar */}
            <div className="w-full h-16 bg-black flex items-center px-6 gap-4">
              <div className="flex gap-2">
                <div className="w-4 h-4 rounded-full bg-[#FFE600] border-2 border-transparent" />
                <div className="w-4 h-4 rounded-full bg-green-400 border-2 border-transparent" />
                <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-transparent" />
              </div>
              <div className="h-8 w-64 bg-white/20 mx-auto" />
            </div>
            
            {/* Dashboard Content */}
            <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBoNDBWMEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik00MCAwaC0xdjM5SDB2MWg0MFYweiIgZmlsbD0iI2QxZDVkYiIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9Ijk5OSUiIGhlaWdodD0iOTk5JSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]">
              
              {/* Sidebar */}
              <div className="lg:col-span-3 space-y-6">
                 <div className="bg-black text-[#FFE600] font-black p-4 uppercase tracking-wider flex items-center gap-3 shadow-[4px_4px_0_0_#FFE600] -rotate-1"><LayoutDashboard /> Default Layout</div>
                 <div className="bg-white border-4 border-black p-4 font-black shadow-[4px_4px_0_0_#000] rotate-1">Your Subjects</div>
                 <div className="bg-white border-4 border-black p-4 font-black shadow-[4px_4px_0_0_#000] -rotate-2">Timetable Sync</div>
                 <div className="bg-white border-4 border-black p-4 font-black shadow-[4px_4px_0_0_#000] rotate-2">Resources</div>
              </div>
              
              {/* Main Area */}
              <div className="lg:col-span-9 space-y-8">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                   <div className="bg-[#FFE600] border-4 border-black p-6 shadow-[8px_8px_0_0_#000] rotate-1">
                      <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-4">
                        <h3 className="font-black text-xl uppercase">Next Class</h3>
                        <Activity className="h-8 w-8" />
                      </div>
                      <div className="space-y-4">
                        <div className="bg-black text-white font-black p-3 inline-block">10:00 AM</div>
                        <p className="font-bold text-lg">Applied Mathematics - Room 402</p>
                      </div>
                   </div>

                   <div className="bg-rose-400 border-4 border-black p-6 shadow-[8px_8px_0_0_#000] -rotate-1 transform sm:translate-y-4">
                      <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-4">
                        <h3 className="font-black text-xl uppercase text-black">Critial Alert</h3>
                        <BellRing className="h-8 w-8" />
                      </div>
                      <div className="space-y-4">
                        <div className="bg-white text-black border-4 border-black font-black p-3 inline-block -rotate-3">URGENT</div>
                        <p className="font-bold text-lg text-black">Physics Lab cancelled today.</p>
                      </div>
                   </div>
                 </div>

                 <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-6 lg:p-10 -rotate-1 mt-10">
                   <h2 className="text-3xl font-black uppercase border-b-4 border-black pb-4 mb-6">Recent Updates</h2>
                   <div className="space-y-4 font-bold">
                     <div className="flex gap-4 p-4 hover:bg-[#FFE600] border-4 border-transparent hover:border-black transition-colors items-center">
                       <div className="bg-black text-white p-2">CR</div>
                       Notes for Unit 3 have been uploaded. Check resources tab.
                     </div>
                     <div className="flex gap-4 p-4 hover:bg-[#FFE600] border-4 border-transparent hover:border-black transition-colors items-center">
                       <div className="bg-black text-[#FFE600] p-2">SYS</div>
                       Tomorrow's timetable has been updated.
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bento / Features Brutalist Grid */}
        <section id="bento" className="py-40 px-6 max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-6 drop-shadow-[4px_4px_0_#FFE600] rotate-1">
              RAW POWER
            </h2>
            <p className="text-xl font-bold border-4 border-black bg-white inline-block px-8 py-3 shadow-[6px_6px_0_0_#000] -rotate-1">
              Everything you need. Zero filler.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Block 1 */}
            <div className="lg:col-span-2 bg-[#FFE600] border-8 border-black p-10 lg:p-16 shadow-[12px_12px_0_0_#000] hover:shadow-none hover:translate-x-3 hover:translate-y-3 transition-all relative overflow-hidden">
              <CalendarDays className="h-20 w-20 mb-8 z-10 relative" />
              <h3 className="text-4xl sm:text-5xl font-black uppercase mb-6 leading-none relative z-10">Intelligent <br />Timetable Sync</h3>
              <p className="text-xl font-bold max-w-md relative z-10">Real-time schedule synchronization. When a class drops, your dashboard knows immediately.</p>
              
              {/* Decorative elements */}
              <div className="absolute right-[-10%] bottom-[-10%] w-[300px] h-[300px] border-[20px] border-black rounded-full opacity-20 pointer-events-none" />
              <div className="absolute right-10 top-10 text-9xl font-black opacity-10 pointer-events-none">01</div>
            </div>

             {/* Block 2 */}
             <div className="lg:col-span-1 bg-[#F4F4F0] border-8 border-black p-10 shadow-[12px_12px_0_0_#000] hover:shadow-none hover:translate-x-3 hover:translate-y-3 transition-all">
              <Users className="h-16 w-16 mb-8" />
              <h3 className="text-3xl font-black uppercase mb-4 leading-none">Class Hub</h3>
              <p className="text-lg font-bold">Connect your entire section. Class Rep controls with absolute authority.</p>
            </div>

            {/* Block 3 */}
             <div className="lg:col-span-1 bg-black text-white border-8 border-black p-10 shadow-[12px_12px_0_0_#FFE600] hover:shadow-none hover:translate-x-3 hover:translate-y-3 transition-all">
              <BellRing className="h-16 w-16 mb-8 text-[#FFE600]" />
              <h3 className="text-3xl font-black uppercase mb-4 leading-none text-[#FFE600]">Instant Alerts</h3>
              <p className="text-lg font-bold">Loud, undeniable push notifications for urgent academic shifts.</p>
            </div>

             {/* Block 4 */}
             <div className="lg:col-span-2 bg-[#F4F4F0] border-8 border-black p-10 lg:p-16 shadow-[12px_12px_0_0_#000] hover:shadow-none hover:translate-x-3 hover:translate-y-3 transition-all relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')]">
              <div className="flex flex-col md:flex-row gap-10 items-start md:items-center relative z-10">
                <div className="flex-1">
                  <div className="bg-black text-[#FFE600] inline-block p-4 mb-6 border-4 border-black shadow-[4px_4px_0_0_#FFE600] -rotate-3">
                    <BookOpen className="h-12 w-12" />
                  </div>
                  <h3 className="text-4xl sm:text-5xl font-black uppercase mb-6 leading-none">Vault Storage</h3>
                  <p className="text-xl font-bold">No more digging through chats. Centralized subject resources, notes, and past exams.</p>
                </div>
                <div className="shrink-0 bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000] rotate-3 font-black space-y-3">
                   <div className="flex items-center gap-3 border-b-4 border-black pb-2"><Shield /> SECURE</div>
                   <div className="flex items-center gap-3 border-b-4 border-black pb-2"><Activity /> FAST</div>
                   <div className="flex items-center gap-3"><Zap /> RELIABLE</div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Heavy CTA */}
        <section className="py-32 px-6 relative z-10">
          <div className="max-w-5xl mx-auto bg-[#FFE600] border-8 border-black p-12 sm:p-24 text-center shadow-[16px_16px_0_0_#000] -rotate-1 relative group overflow-hidden">
            
            <div className="absolute inset-0 border-[40px] border-black opacity-5 group-hover:scale-95 transition-transform duration-500 pointer-events-none" />

            <h2 className="text-5xl sm:text-[5rem] font-black tracking-tighter uppercase mb-10 leading-[0.9] relative z-10 text-black">
              DESTROY <br className="hidden sm:block" />
              CONFUSION.
            </h2>
            <p className="text-2xl font-bold mb-12 max-w-2xl mx-auto text-black/80 relative z-10">
              Join the academic elite today. Take complete control of your college timeline.
            </p>

            <button
              onClick={() => navigate('/login')}
              className="relative z-10 w-full sm:w-auto group px-12 py-6 bg-black text-[#FFE600] font-black uppercase tracking-widest text-xl border-4 border-black shadow-[8px_8px_0_0_#fff] hover:shadow-[4px_4px_0_0_#fff] hover:translate-y-1 hover:translate-x-1 active:shadow-none active:translate-y-2 active:translate-x-2 transition-all flex items-center justify-center gap-4 mx-auto"
            >
              Sign Up Now <Zap className="h-6 w-6 fill-[#FFE600]" />
            </button>
          </div>
        </section>
      </main>

      {/* Brutalist Footer */}
      <footer className="border-t-8 border-black bg-white pt-20 pb-10 px-6 sm:px-12 relative z-10 font-black uppercase">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 mb-20">
            <div className="flex items-center gap-4">
               {/* Footer Logo */}
               <img 
                src="/logo.png" 
                alt="RemindrX" 
                className="h-10 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <span className="hidden text-3xl italic tracking-tighter drop-shadow-[2px_2px_0_#FFE600]">
                REMINDRX <Star className="inline h-6 w-6 text-[#FFE600] fill-[#FFE600] drop-shadow-[2px_2px_0_#000] -translate-y-2 translate-x-1" />
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:flex gap-x-12 gap-y-6 tracking-widest text-black/70">
              <a href="#" className="hover:text-[#FFE600] hover:pl-2 transition-all border-b-4 border-transparent hover:border-black">Features</a>
              <a href="#" className="hover:text-[#FFE600] hover:pl-2 transition-all border-b-4 border-transparent hover:border-black">About</a>
              <a href="#" className="hover:text-[#FFE600] hover:pl-2 transition-all border-b-4 border-transparent hover:border-black">System</a>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-t-8 border-black pt-10 text-sm tracking-widest bg-[#FFE600] -mx-6 sm:-mx-12 px-6 sm:px-12 pb-6 pt-6">
            <p>© {new Date().getFullYear()} REMINDRX. WE OWN THE TIMETABLE.</p>
            <p className="flex items-center gap-2"><Zap className="h-4 w-4 fill-black" /> STAY SHARP.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}