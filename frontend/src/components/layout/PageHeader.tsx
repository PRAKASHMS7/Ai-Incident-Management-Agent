import React from 'react';
import { Search } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  showSearch?: boolean;
  placeholder?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  showSearch = true,
  placeholder = "Search incidents..."
}) => {
  return (
    <div className="w-full flex flex-col gap-2 mb-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Page Title: Purple to Blue Gradient, 48px, Font weight 800 */}
        <h1 className="text-[48px] font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-blue-400 bg-clip-text text-transparent font-sans leading-tight">
          {title}
        </h1>

        {/* Moved Search Bar */}
        {showSearch && (
          <div className="relative w-[420px] hidden xl:block shrink-0">
            <input 
              type="text" 
              placeholder={placeholder}
              className="w-full bg-[#050816] border border-slate-800 rounded-xl py-2.5 pl-9 pr-12 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/40"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            <span className="absolute right-2.5 top-2.5 bg-[#0B1020] border border-slate-800 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-500 font-mono">Ctrl + K</span>
          </div>
        )}
      </div>

      {/* Subtitle: slightly increased font size, subtle gradient, improved contrast, subtle glow animation */}
      <p className="text-[15px] font-medium leading-relaxed max-w-4xl text-slate-300 bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent animate-pulse-glow">
        {subtitle}
      </p>
    </div>
  );
};
export default PageHeader;
