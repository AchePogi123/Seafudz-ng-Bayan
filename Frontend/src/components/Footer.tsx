import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-white pt-16 pb-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">
        {/* Column 1: Brand Info */}
        <div className="lg:col-span-2 space-y-4 text-left">
          <BrandLogo variant="dark" size="md" />

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
            Serving authentic Filipino seafood bilao platters, Cajun boils, and fresh catch daily sourced directly from local coastal fishermen straight to your family's table.
          </p>

          <div className="pt-2 text-xs text-slate-400">
            <span className="font-bold text-white">Daily Hours:</span> 10:00 AM to 10:00 PM (Monday to Sunday)
          </div>
        </div>

        {/* Column 2: Quick Links */}
        <div className="space-y-3 text-left">
          <h4 className="text-xs font-bold text-orange-500 tracking-wider uppercase">
            Navigation
          </h4>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
            <li>
              <Link to="/customer" className="hover:text-orange-400 transition-colors">
                Order Online
              </Link>
            </li>
            <li>
              <a href="#specialties" className="hover:text-orange-400 transition-colors">
                Signature Platters
              </a>
            </li>
            <li>
              <a href="#standards" className="hover:text-orange-400 transition-colors">
                Our Standard
              </a>
            </li>
            <li>
              <a href="#our-story" className="hover:text-orange-400 transition-colors">
                Our Story
              </a>
            </li>
            <li>
              <a href="#branches" className="hover:text-orange-400 transition-colors">
                Branch Locations
              </a>
            </li>
            <li>
              <a href="#faqs" className="hover:text-orange-400 transition-colors">
                Frequently Asked Questions
              </a>
            </li>
          </ul>
        </div>

        {/* Column 3: Active Branch */}
        <div className="space-y-3 text-left">
          <h4 className="text-xs font-bold text-orange-500 tracking-wider uppercase">
            Active Branch
          </h4>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-400">
            <div>
              <li className="font-bold text-white">Caloocan Main Branch</li>
              <li className="text-xs text-slate-500">Caloocan City, Metro Manila</li>
              <li className="text-[11px] text-emerald-400 mt-1">Open 10:00 AM to 10:00 PM</li>
            </div>
            <div>
              <li className="font-semibold text-slate-300">Delivery Coverage</li>
              <li className="text-xs text-slate-500">Serving Metro Manila with thermal heat packaging</li>
            </div>
          </ul>
        </div>

        {/* Column 4: Contact & Hotline */}
        <div className="space-y-3 text-left">
          <h4 className="text-xs font-bold text-orange-500 tracking-wider uppercase">
            Contact & Support
          </h4>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-400">
            <li>
              <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Hotline</span>
              <span className="text-white font-semibold text-sm">(02) 8888-SEAFOOD</span>
            </li>
            <li>
              <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Mobile</span>
              <span>+63 917 123 4567</span>
            </li>
            <li>
              <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Email</span>
              <span>orders@seafudzngbayan.ph</span>
            </li>
            <li className="pt-2">
              <Link
                to="/login"
                className="inline-block text-xs font-bold text-orange-400 hover:text-orange-300 underline"
              >
                Login / Register
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <p>© 2026 Seafudz Ng Bayan Inc. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <span className="text-slate-400">Fresh Catch Daily Guaranteed</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Metro Manila Delivery</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
