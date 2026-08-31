import React from 'react'
import { Link } from 'react-router-dom'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#00141d] text-white pt-20 pb-10 px-6 md:px-[8%] border-t border-white/10 relative overflow-hidden font-sans">
      {/* Background Subtle Ambient Spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-b from-[#0a9396]/15 via-[#005f73]/10 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-[1250px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-16 border-b border-white/10">
        {/* Column 1: Brand Info */}
        <div className="lg:col-span-2 space-y-5 text-left">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-extrabold text-base shadow-md group-hover:scale-105 transition-transform">
              S
            </div>
            <span className="text-xl font-bold tracking-tight font-serif text-white group-hover:text-orange-400 transition-colors">
              Seafudz Ng Bayan
            </span>
          </Link>

          <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
            Serving authentic Filipino seafood bilao platters, Cajun boils, and fresh catch daily directly sourced from local coastal fishermen straight to your family's table.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-3 pt-2">
            <a href="#" aria-label="Facebook" className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-white/80 hover:text-white hover:bg-orange-500 hover:border-orange-500 flex items-center justify-center transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.891h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </a>
            <a href="#" aria-label="Instagram" className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-white/80 hover:text-white hover:bg-orange-500 hover:border-orange-500 flex items-center justify-center transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a href="#" aria-label="TikTok" className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-white/80 hover:text-white hover:bg-orange-500 hover:border-orange-500 flex items-center justify-center transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 11-2.89-2.89c.28 0 .56.04.82.11V9.4a6.34 6.34 0 106.34 6.34V9.6a8.27 8.27 0 004.95 1.6V7.75a4.8 4.8 0 01-2-.06z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Column 2: Quick Links */}
        <div className="space-y-4 text-left">
          <h4 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
            Navigation
          </h4>
          <ul className="space-y-2.5 text-xs text-neutral-400">
            <li>
              <Link to="/customer" className="hover:text-orange-400 transition-colors">
                Order Online
              </Link>
            </li>
            <li>
              <Link to="/pos" className="hover:text-orange-400 transition-colors">
                Cashier POS
              </Link>
            </li>
            <li>
              <Link to="/kitchen" className="hover:text-orange-400 transition-colors">
                Kitchen System
              </Link>
            </li>
            <li>
              <Link to="/sales-report" className="hover:text-orange-400 transition-colors">
                Sales & Reports
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-orange-400 transition-colors">
                About Seafudz
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Branch Locations */}
        <div className="space-y-4 text-left">
          <h4 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
            Branches
          </h4>
          <ul className="space-y-3 text-xs text-neutral-400">
            <div>
              <li className="font-bold text-neutral-200">Central Bay (Main)</li>
              <li className="text-[11px] text-neutral-400">Manila Bay Shoreline</li>
            </div>
            <div>
              <li className="font-bold text-neutral-200">Quezon City Hub</li>
              <li className="text-[11px] text-neutral-400">Timog Ave, QC</li>
            </div>
            <div>
              <li className="font-bold text-neutral-200">Alabang Coastal</li>
              <li className="text-[11px] text-neutral-400">Filinvest City, Alabang</li>
            </div>
          </ul>
        </div>

        {/* Column 4: Contact & Hotline */}
        <div className="space-y-4 text-left">
          <h4 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
            Contact & Hotline
          </h4>
          <ul className="space-y-2.5 text-xs text-neutral-400">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>(02) 8888-SEAFOOD</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>+63 917 123 4567</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>hello@seafudzngbayan.ph</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="max-w-[1250px] mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
        <p>© 2026 Seafudz Ng Bayan Inc. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-neutral-300 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-neutral-300 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-neutral-300 transition-colors">Branch Locator</a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
