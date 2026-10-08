import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0B132B] text-white pt-10 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8 border-t border-cyan-950/60 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-10 pb-8 sm:pb-12 border-b border-cyan-950/60">
        {/* Column 1: Brand Info */}
        <div className="col-span-2 lg:col-span-2 space-y-3.5 text-left">
          <BrandLogo
            variant="dark"
            size="md"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed max-w-sm">
            Serving authentic Filipino seafood bilao platters, Cajun boils, and fresh catch daily sourced directly from local coastal fishermen straight to your family's table.
          </p>

          <div className="pt-1 text-xs text-slate-300/80 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span><strong className="text-white">Daily Hours:</strong> 10:00 AM to 10:00 PM</span>
          </div>
        </div>

        {/* Column 2: Quick Links */}
        <div className="col-span-1 space-y-3 text-left">
          <h4 className="text-xs font-bold text-orange-400 tracking-wider uppercase">
            Navigation
          </h4>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-300/90">
            <li>
              <Link to="/customer" className="hover:text-cyan-300 transition-colors duration-200">
                Order Online
              </Link>
            </li>
            <li>
              <a href="#specialties" className="hover:text-cyan-300 transition-colors duration-200">
                Signature Platters
              </a>
            </li>
            <li>
              <a href="#standards" className="hover:text-cyan-300 transition-colors duration-200">
                Our Standard
              </a>
            </li>
            <li>
              <a href="#our-story" className="hover:text-cyan-300 transition-colors duration-200">
                Our Story
              </a>
            </li>
            <li>
              <a href="#branches" className="hover:text-cyan-300 transition-colors duration-200">
                Branches
              </a>
            </li>
            <li>
              <a href="#faqs" className="hover:text-cyan-300 transition-colors duration-200">
                FAQs
              </a>
            </li>
          </ul>
        </div>

        {/* Column 3: Contact & Support */}
        <div className="col-span-1 space-y-3 text-left">
          <h4 className="text-xs font-bold text-orange-400 tracking-wider uppercase">
            Contact & Support
          </h4>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-300/90">
            <li>
              <span className="text-slate-400 block text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">Hotline</span>
              <span className="text-white font-semibold text-xs sm:text-sm">(02) 8888-SEAFOOD</span>
            </li>
            <li>
              <span className="text-slate-400 block text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">Mobile</span>
              <span className="text-slate-200 text-xs sm:text-sm">+63 917 123 4567</span>
            </li>
            <li>
              <span className="text-slate-400 block text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">Email</span>
              <span className="text-slate-200 text-xs sm:text-sm break-all">orders@seafudzngbayan.ph</span>
            </li>
            <li className="pt-1">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-xs font-bold text-orange-400 hover:text-cyan-300 transition-colors"
              >
                Staff Portal <span>→</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 4: Active Branch */}
        <div className="col-span-2 lg:col-span-1 space-y-3 text-left">
          <h4 className="text-xs font-bold text-orange-400 tracking-wider uppercase">
            Active Branch
          </h4>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-300/90">
            <div className="p-3.5 rounded-xl bg-[#131F42]/70 border border-cyan-900/40 shadow-inner">
              <li className="font-bold text-white">Caloocan Main Branch</li>
              <li className="text-xs text-slate-300 mt-0.5">Caloocan City, Metro Manila</li>
              <li className="text-[11px] text-emerald-400 font-medium mt-1">Open 10:00 AM to 10:00 PM</li>
            </div>
            <div>
              <li className="font-semibold text-slate-200">Delivery Coverage</li>
              <li className="text-xs text-slate-400 mt-0.5">Serving Metro Manila with thermal heat packaging</li>
            </div>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="max-w-7xl mx-auto pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3 text-center sm:text-left">
        <p>© 2026 Seafudz Ng Bayan Inc. All rights reserved.</p>
        <div className="flex items-center gap-4 sm:gap-6 text-[11px] sm:text-xs">
          <span className="text-slate-300">Fresh Catch Daily</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300">Metro Manila Delivery</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
