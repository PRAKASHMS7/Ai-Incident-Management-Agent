import React, { useState } from 'react';
import { Brain } from 'lucide-react';
import loginBgFullscreen from '../assets/login_bg_fullscreen.jpg';

export const LoginPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('demo-auth', 'true');
    localStorage.setItem('username', name);
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050816] select-none items-center justify-end pr-12 md:pr-24 lg:pr-36 relative">
      {/* 1. Full Screen Background Image with slow zoom animation */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: `url(${loginBgFullscreen})`,
          animation: 'slow-zoom 30s ease-in-out infinite',
          filter: 'brightness(1.15) contrast(1.12)'
        }}
      />
      
      {/* 2. Premium dark linear overlay (40% to 50% opacity) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050816]/55 via-[#050816]/48 to-[#050816]/42" />

      {/* 3. Ambient nebula glows */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none animate-nebula-pulse" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none animate-nebula-pulse-delayed" />

      {/* 4. Soft floating cosmic particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute w-1.5 h-1.5 bg-purple-400/30 rounded-full blur-[0.5px] animate-cosmic-1" style={{ left: '25%', top: '65%' }} />
        <div className="absolute w-2 h-2 bg-blue-400/20 rounded-full blur-[0.5px] animate-cosmic-2" style={{ left: '75%', top: '25%' }} />
        <div className="absolute w-1 h-1 bg-white/30 rounded-full blur-[0.5px] animate-cosmic-3" style={{ left: '45%', top: '15%' }} />
        <div className="absolute w-1.5 h-1.5 bg-indigo-400/30 rounded-full blur-[0.5px] animate-cosmic-4" style={{ left: '60%', top: '75%' }} />
      </div>

      {/* 5. Right Glassmorphism Login Card (with float container) */}
      <div className="w-full max-w-[520px] animate-card-float shrink-0 z-10 animate-fade-in-right">
        {/* Dark navy glass surface, 85% opacity, 2xl backdrop-blur */}
        <div className="w-full bg-[#0B1224]/85 backdrop-blur-2xl border border-white/[0.08] p-10 md:p-12 rounded-3xl shadow-2xl flex flex-col gap-7 relative overflow-hidden group hover:border-purple-500/25 hover:-translate-y-1.5 hover:shadow-[0_15px_50px_-10px_rgba(0,0,0,0.6),0_0_40px_-2px_rgba(168,85,247,0.25),0_0_40px_-2px_rgba(59,130,246,0.25)] transition-all duration-500">
          {/* Subtle diagonal glass sweep reflection */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1200ms] ease-out pointer-events-none" />

          {/* Login Card Header */}
          <div className="flex flex-col gap-4">
            {/* Small Brand Icon */}
            <div className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.25)]">
              <Brain className="w-5.5 h-5.5 animate-pulse" />
            </div>

            <div className="flex flex-col gap-2.5">
              <h2 className="text-[28px] font-black text-white tracking-tight leading-[1.15]">
                Welcome to AI Incident Management
              </h2>
              <p className="text-[13.5px] text-slate-300 font-medium leading-relaxed">
                Intelligent Incident Detection, RCA & Escalation Platform
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5.5">
            {/* Name Field */}
            <div className="flex flex-col gap-2">
              <label className="text-[11.5px] font-extrabold text-slate-300 uppercase tracking-wider">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prakash"
                className="w-full bg-[#02040a] border border-slate-700/80 rounded-xl py-3 px-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors font-medium"
              />
            </div>

            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label className="text-[11.5px] font-extrabold text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@sre-center.ai"
                className="w-full bg-[#02040a] border border-slate-700/80 rounded-xl py-3 px-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors font-medium"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label className="text-[11.5px] font-extrabold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#02040a] border border-slate-700/80 rounded-xl py-3 px-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors font-medium"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-550 hover:via-indigo-550 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all duration-300 shadow-[0_0_25px_rgba(168,85,247,0.35)] hover:shadow-[0_0_35px_rgba(168,85,247,0.55)] hover:-translate-y-0.5"
            >
              Enter Dashboard
            </button>
          </form>
        </div>
      </div>

      {/* Styled inline helper for animations */}
      <style>{`
        @keyframes slow-zoom {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes card-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes nebula-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes nebula-pulse-delayed {
          0%, 100% { transform: scale(1.05); opacity: 1; }
          50% { transform: scale(1); opacity: 0.9; }
        }
        @keyframes sweep {
          0% { transform: translateX(-150%) translateY(-150%) rotate(45deg); }
          15%, 100% { transform: translateX(150%) translateY(150%) rotate(45deg); }
        }
        @keyframes cosmic-1 {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
          50% { transform: translateY(-25px) translateX(12px); opacity: 0.7; }
        }
        @keyframes cosmic-2 {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.2; }
          50% { transform: translateY(20px) translateX(-15px); opacity: 0.6; }
        }
        @keyframes cosmic-3 {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.4; }
          50% { transform: translateY(-15px) translateX(-8px); opacity: 0.8; }
        }
        @keyframes cosmic-4 {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.7; }
        }
        
        .animate-card-float {
          animation: card-float 8s ease-in-out infinite;
        }
        .animate-nebula-pulse {
          animation: nebula-pulse 14s ease-in-out infinite;
        }
        .animate-nebula-pulse-delayed {
          animation: nebula-pulse-delayed 18s ease-in-out infinite;
        }
        .animate-cosmic-1 { animation: cosmic-1 8s ease-in-out infinite; }
        .animate-cosmic-2 { animation: cosmic-2 10s ease-in-out infinite; }
        .animate-cosmic-3 { animation: cosmic-3 7s ease-in-out infinite; }
        .animate-cosmic-4 { animation: cosmic-4 9s ease-in-out infinite; }
        
        .animate-fade-in-right {
          animation: fadeInRight 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(35px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
