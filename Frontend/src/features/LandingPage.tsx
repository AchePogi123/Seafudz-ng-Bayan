import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AccordionGallery from '../components/AccordionGallery';
import ClickStack from '../components/ClickStack';
import Footer from '../components/Footer';

import seafoodBilaoImg from '../assets/seafood_bilao.png';
import seafoodCajunImg from '../assets/seafood_cajun.png';
import spicyShrimpImg from '../assets/spicy_shrimp.png';
import crabBucketImg from '../assets/crab_bucket.png';
import garlicButterShrimpImg from '../assets/garlic_butter_shrimp.png';

interface ArchivedItem {
  id: string;
  name: string;
  category: 'Seasonal' | 'Retired Classic' | 'Vault Recipe';
  yearArchived: string;
  description: string;
  originalPrice: number;
  image: string;
  flavorProfile: string;
  status: 'In Vault' | 'Returning Soon' | 'Special Event';
}

const ARCHIVED_ITEMS: ArchivedItem[] = [
  {
    id: 'arch-1',
    name: 'Smoked Garlic Butter Lobster Feast',
    category: 'Seasonal',
    yearArchived: 'Summer 2024',
    description: 'Fresh Atlantic lobster tail sauteed in aged garlic butter with smoked sea salt and sweet corn coblets.',
    originalPrice: 2890,
    image: seafoodBilaoImg,
    flavorProfile: 'Garlic Smoked & Rich',
    status: 'Returning Soon'
  },
  {
    id: 'arch-2',
    name: 'Imperial Cajun King Crab Bucket',
    category: 'Vault Recipe',
    yearArchived: 'Winter 2023',
    description: 'Wild jumbo king crab legs drenched in house-blend 12-spice Cajun rub served with toasted mantou buns.',
    originalPrice: 3450,
    image: crabBucketImg,
    flavorProfile: 'Bold Cajun & Spicy',
    status: 'In Vault'
  },
  {
    id: 'arch-3',
    name: 'Fire-Roasted Chili Tiger Prawns',
    category: 'Retired Classic',
    yearArchived: 'Autumn 2024',
    description: 'Char-grilled tiger prawns glazed with hot bird’s eye chili marmalade and fresh kaffir lime zest.',
    originalPrice: 1450,
    image: spicyShrimpImg,
    flavorProfile: 'Citrusy Zesty Heat',
    status: 'Special Event'
  },
  {
    id: 'arch-4',
    name: 'Bayfront Seafood Paella Supreme',
    category: 'Vault Recipe',
    yearArchived: 'Spring 2024',
    description: 'Spanish saffron rice infused with clam reduction, mussels, squid rings, and giant head-on prawns.',
    originalPrice: 2200,
    image: seafoodCajunImg,
    flavorProfile: 'Savory Saffron & Shellfish',
    status: 'In Vault'
  },
  {
    id: 'arch-5',
    name: 'Crispy Garlic Butter Soft-Shell Crabs',
    category: 'Seasonal',
    yearArchived: 'Monsoon 2024',
    description: 'Golden-fried soft shell crabs tossed in caramelized butter garlic chips and scallion oil.',
    originalPrice: 1680,
    image: garlicButterShrimpImg,
    flavorProfile: 'Crunchy Umami Garlic',
    status: 'Returning Soon'
  },
  {
    id: 'arch-6',
    name: 'Charred Saffron Butter Scallop Tower',
    category: 'Retired Classic',
    yearArchived: 'Winter 2024',
    description: 'Pan-seared jumbo sea scallops stacked over charred cauliflower puree and saffron brown butter.',
    originalPrice: 1950,
    image: spicyShrimpImg,
    flavorProfile: 'Velvety Saffron & Umami',
    status: 'Special Event'
  }
];

export const LandingPage: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<ArchivedItem | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState<'home' | 'story' | 'archive' | 'faq'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isNavClickRef = useRef(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 40);

          if (!isNavClickRef.current) {
            const storyEl = document.getElementById('our-story');
            const archiveEl = document.getElementById('seafood-archive');
            const faqEl = document.getElementById('faq-section');

            if (faqEl && faqEl.getBoundingClientRect().top <= 350) {
              setActiveNav('faq');
            } else if (archiveEl && archiveEl.getBoundingClientRect().top <= 350) {
              setActiveNav('archive');
            } else if (storyEl && storyEl.getBoundingClientRect().top <= 350) {
              setActiveNav('story');
            } else {
              setActiveNav('home');
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToHome = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveNav('home');
    setIsMobileMenuOpen(false);
    isNavClickRef.current = true;
    window.scrollTo({ top: 0, behavior: 'auto' });
    setTimeout(() => { isNavClickRef.current = false; }, 800);
  };

  const scrollToStory = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveNav('story');
    setIsMobileMenuOpen(false);
    isNavClickRef.current = true;
    document.getElementById('our-story')?.scrollIntoView({ behavior: 'auto' });
    setTimeout(() => { isNavClickRef.current = false; }, 800);
  };

  const scrollToArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveNav('archive');
    setIsMobileMenuOpen(false);
    isNavClickRef.current = true;
    document.getElementById('seafood-archive')?.scrollIntoView({ behavior: 'auto' });
    setTimeout(() => { isNavClickRef.current = false; }, 800);
  };

  const scrollToFaq = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveNav('faq');
    setIsMobileMenuOpen(false);
    isNavClickRef.current = true;
    document.getElementById('faq-section')?.scrollIntoView({ behavior: 'auto' });
    setTimeout(() => { isNavClickRef.current = false; }, 800);
  };

  return (
    <div className="font-sans text-neutral-800 bg-[#faf9f6] min-h-screen relative">
      {/* Dynamic Adaptive Topbar */}
      <header className="fixed top-4 inset-x-0 z-50 flex flex-col items-center px-4 pointer-events-none">
        <nav className={`pointer-events-auto flex items-center justify-between w-full max-w-5xl px-4 sm:px-5 py-3 rounded-2xl duration-500 ${!isScrolled
          ? 'bg-black/25 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)]'
          : activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq'
            ? 'bg-gradient-to-r from-black/70 via-[#001e28]/80 to-black/70 backdrop-blur-md border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.4)]'
            : 'bg-white/90 backdrop-blur-md border border-neutral-200/90 shadow-[0_10px_30px_rgba(0,0,0,0.12)]'
          }`}>
          {/* Logo */}
          <Link to="/" onClick={scrollToHome} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
              S
            </div>
            <span className={`text-sm font-bold tracking-tight font-serif ${!isScrolled || activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq' ? 'text-white drop-shadow-md' : 'text-neutral-900'
              }`}>
              Seafudz Ng Bayan
            </span>
          </Link>

          {/* Centered Nav Links (Desktop) */}
          <div className={`hidden md:flex items-center gap-7 px-5 py-1.5 rounded-xl ${!isScrolled
            ? 'bg-white/10 backdrop-blur-sm border border-white/20'
            : activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq'
              ? 'bg-white/10 backdrop-blur-md border border-white/15'
              : 'bg-neutral-100/80 border border-neutral-200/50'
            }`}>
            <a
              href="#"
              onClick={scrollToHome}
              className={`relative text-xs font-bold py-1 ease-out ${activeNav === 'home'
                ? 'text-orange-500 font-extrabold'
                : !isScrolled || activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq'
                  ? 'text-neutral-200 hover:text-white'
                  : 'text-neutral-600 hover:text-orange-600'
                }`}
            >
              Home
              <span className={`absolute -bottom-1 left-0 right-0 h-0.5 bg-orange-500 rounded-full ease-out ${activeNav === 'home' ? 'w-full opacity-100' : 'w-0 opacity-0'
                }`} />
            </a>
            <a
              href="#our-story"
              onClick={scrollToStory}
              className={`relative text-xs font-bold py-1 ease-out ${activeNav === 'story'
                ? 'text-[#00b4d8] font-extrabold'
                : !isScrolled || activeNav === 'archive' || activeNav === 'faq'
                  ? 'text-neutral-200 hover:text-white'
                  : 'text-neutral-600 hover:text-[#00b4d8]'
                }`}
            >
              Our Story
              <span className={`absolute -bottom-1 left-0 right-0 h-0.5 bg-[#00b4d8] rounded-full ease-out ${activeNav === 'story' ? 'w-full opacity-100' : 'w-0 opacity-0'
                }`} />
            </a>
            <a
              href="#seafood-archive"
              onClick={scrollToArchive}
              className={`relative text-xs font-bold py-1 ease-out ${activeNav === 'archive'
                ? 'text-[#00b4d8] font-extrabold'
                : !isScrolled || activeNav === 'story' || activeNav === 'faq'
                  ? 'text-neutral-200 hover:text-white'
                  : 'text-neutral-600 hover:text-[#00b4d8]'
                }`}
            >
              Archive
              <span className={`absolute -bottom-1 left-0 right-0 h-0.5 bg-[#00b4d8] rounded-full ease-out ${activeNav === 'archive' ? 'w-full opacity-100' : 'w-0 opacity-0'
                }`} />
            </a>
            <a
              href="#faq-section"
              onClick={scrollToFaq}
              className={`relative text-xs font-bold py-1 ease-out ${activeNav === 'faq'
                ? 'text-[#00b4d8] font-extrabold'
                : !isScrolled || activeNav === 'story' || activeNav === 'archive'
                  ? 'text-neutral-200 hover:text-white'
                  : 'text-neutral-600 hover:text-[#00b4d8]'
                }`}
            >
              FAQ
              <span className={`absolute -bottom-1 left-0 right-0 h-0.5 bg-[#00b4d8] rounded-full ease-out ${activeNav === 'faq' ? 'w-full opacity-100' : 'w-0 opacity-0'
                }`} />
            </a>
          </div>

          {/* Action Button (Desktop only) */}
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className={`hidden md:flex items-center gap-2 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md ${activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq'
                ? 'bg-gradient-to-r from-[#00b4d8] to-[#0077b6] hover:from-[#0077b6] hover:to-[#00b4d8] shadow-[0_4px_20px_rgba(0,180,216,0.4)]'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-500/25'
                }`}
            >
              <span>Login / Register</span>
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-2 focus:outline-none rounded-xl border cursor-pointer md:hidden ${!isScrolled || activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq'
                ? 'text-white bg-white/20 border-white/30 hover:bg-white/30'
                : 'text-neutral-800 bg-neutral-100 border-neutral-300 hover:bg-neutral-200'
                }`}
              aria-label="Toggle mobile navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile Smooth-Sliding Navigation Panel */}
        <div
          className={`pointer-events-auto md:hidden w-full max-w-5xl ease-in-out overflow-hidden ${isMobileMenuOpen
            ? 'max-h-96 opacity-100 mt-2 py-4 px-4 translate-y-0'
            : 'max-h-0 opacity-0 mt-0 py-0 px-4 -translate-y-2 pointer-events-none'
            } rounded-2xl text-left border ${!isScrolled
              ? 'bg-black/25 backdrop-blur-md border-white/20 text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)]'
              : activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq'
                ? 'bg-gradient-to-r from-black/70 via-[#001e28]/80 to-black/70 backdrop-blur-md border-white/20 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)]'
                : 'bg-white/90 backdrop-blur-md border-neutral-200/90 text-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,0.12)]'
            }`}
        >
          <div className="space-y-2 font-sans">
            <a
              href="#"
              onClick={scrollToHome}
              className={`block px-4 py-2.5 rounded-xl text-xs font-bold ${activeNav === 'home'
                ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30 font-extrabold'
                : !isScrolled || activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq'
                  ? 'text-white/90 hover:bg-white/10'
                  : 'text-neutral-700 hover:bg-neutral-100'
                }`}
            >
              Home
            </a>
            <a
              href="#our-story"
              onClick={scrollToStory}
              className={`block px-4 py-2.5 rounded-xl text-xs font-bold ${activeNav === 'story'
                ? 'bg-[#00b4d8]/20 text-[#00b4d8] border border-[#00b4d8]/30 font-extrabold'
                : !isScrolled || activeNav === 'archive' || activeNav === 'faq'
                  ? 'text-white/90 hover:bg-white/10'
                  : 'text-neutral-700 hover:bg-neutral-100'
                }`}
            >
              Our Story
            </a>
            <a
              href="#seafood-archive"
              onClick={scrollToArchive}
              className={`block px-4 py-2.5 rounded-xl text-xs font-bold ${activeNav === 'archive'
                ? 'bg-[#00b4d8]/20 text-[#00b4d8] border border-[#00b4d8]/30 font-extrabold'
                : !isScrolled || activeNav === 'story' || activeNav === 'faq'
                  ? 'text-white/90 hover:bg-white/10'
                  : 'text-neutral-700 hover:bg-neutral-100'
                }`}
            >
              Archive
            </a>
            <a
              href="#faq-section"
              onClick={scrollToFaq}
              className={`block px-4 py-2.5 rounded-xl text-xs font-bold ${activeNav === 'faq'
                ? 'bg-[#00b4d8]/20 text-[#00b4d8] border border-[#00b4d8]/30 font-extrabold'
                : !isScrolled || activeNav === 'story' || activeNav === 'archive'
                  ? 'text-white/90 hover:bg-white/10'
                  : 'text-neutral-700 hover:bg-neutral-100'
                }`}
            >
              FAQ
            </a>
            <div className={`pt-2 border-t ${!isScrolled || activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq' ? 'border-white/10' : 'border-neutral-200'}`}>
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-center text-white text-xs font-bold py-2.5 rounded-xl shadow-md ${activeNav === 'story' || activeNav === 'archive' || activeNav === 'faq'
                  ? 'bg-gradient-to-r from-[#00b4d8] to-[#0077b6] hover:from-[#0077b6] hover:to-[#00b4d8]'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                  }`}
              >
                Login / Register
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with WebGL Interactive Ripple Distortion */}
      <div className="min-h-[75vh] flex items-center justify-center text-center text-white p-8 relative overflow-hidden bg-[#001e28]">
        {/* Static Background Image */}
        <div className="absolute inset-0 z-0">
          <img src={seafoodBilaoImg} alt="Seafood Bilao Feast" className="w-full h-full object-cover opacity-60" />
        </div>

        {/* Ambient Overlay to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60 pointer-events-none z-10" />

        {/* Hero Content */}
        <div className="max-w-[750px] relative z-20">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight leading-tight">Welcome to Seafudz Ng Bayan</h1>
          <p className="text-base md:text-lg font-normal tracking-wide mb-8 text-neutral-100">Fresh Seafood • Dine-in • Take-out • Delivery</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/customer" className="py-3.5 px-8 rounded-xl font-semibold text-sm bg-orange-600 hover:bg-orange-700 text-white shadow-md">
              Order Now
            </Link>
            <a href="#seafood-archive" onClick={scrollToArchive} className="py-3.5 px-8 rounded-xl font-semibold text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20">
              Seafood Archive
            </a>
          </div>
        </div>
      </div>

      {/* Why Choose Us Section */}
      <section className="pt-24 pb-44 px-6 md:px-[8%] bg-gradient-to-b from-[#faf9f6] via-[#faf9f6] to-[#e4dec3]/30 text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-r from-[#0a9396]/20 to-[#94d2bd]/30 blur-3xl rounded-full pointer-events-none -z-10" />

        <div className="max-w-[1200px] mx-auto relative z-20">
          <span className="text-xs font-semibold tracking-widest text-[#005f73] uppercase mb-2 block">
            The Seafudz Experience
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#002d3c] mb-4 tracking-tight">
            Why Choose Us?
          </h2>
          <p className="text-sm md:text-base text-neutral-600 max-w-[620px] mx-auto mb-14 leading-relaxed">
            We source the finest, freshest catch daily from local fishports to bring you authentic, mouth-watering seafood feasts.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="group bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white/60 shadow-sm hover:shadow-xl hover:border-[#0a9396]/40 text-left relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-[#0a9396]/10 border border-[#0a9396]/20 text-[#0a9396] flex items-center justify-center mb-6 group-hover:bg-[#0a9396] group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#002d3c] mb-2.5 tracking-tight group-hover:text-[#0a9396]">
                Fresh Catch Daily
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Directly sourced from local fishports every morning, preserving prime freshness and ocean sweetness.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white/60 shadow-sm hover:shadow-xl hover:border-[#0a9396]/40 text-left relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-[#0a9396]/10 border border-[#0a9396]/20 text-[#0a9396] flex items-center justify-center mb-6 group-hover:bg-[#0a9396] group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#002d3c] mb-2.5 tracking-tight group-hover:text-[#0a9396]">
                6 Prime Branches
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Conveniently located across major hubs, bringing rich seafood bilao feasts right around your corner.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white/60 shadow-sm hover:shadow-xl hover:border-[#0a9396]/40 text-left relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-[#0a9396]/10 border border-[#0a9396]/20 text-[#0a9396] flex items-center justify-center mb-6 group-hover:bg-[#0a9396] group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#002d3c] mb-2.5 tracking-tight group-hover:text-[#0a9396]">
                Fast Hot Delivery
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Piping hot Cajun boils and fried delights dispatched quickly to your doorstep with insulated thermal care.
              </p>
            </div>

            {/* Card 4 */}
            <div className="group bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white/60 shadow-sm hover:shadow-xl hover:border-[#0a9396]/40 text-left relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-[#0a9396]/10 border border-[#0a9396]/20 text-[#0a9396] flex items-center justify-center mb-6 group-hover:bg-[#0a9396] group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h47M4 14h16M4 18h12M14.828 14.828a4 4 0 015.656 0l4.242 4.242a4 4 0 01-5.656 5.656l-4.242-4.242a4 4 0 010-5.656z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#002d3c] mb-2.5 tracking-tight group-hover:text-[#0a9396]">
                Warm Hospitality
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Welcoming Bayanihan service dedicated to ensuring memorable family feasts and hassle-free dining.
              </p>
            </div>
          </div>
        </div>

        {/* Smooth Gradient Blend Overlay to merge into Our Story section */}
        <div className="absolute bottom-0 inset-x-0 h-36 bg-gradient-to-b from-transparent via-[#00b4d8]/40 to-[#00b4d8] pointer-events-none z-10" />
      </section>

      {/* Our Journey & Business Success Story Section */}
      <section id="our-story" className="pt-28 pb-36 px-6 md:px-[8%] bg-gradient-to-b from-[#00b4d8] via-[#0096c7] to-[#0081a7] text-white relative overflow-hidden z-20">


        {/* Ambient Radial Spotlight Background */}
        <div className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-gradient-to-br from-white/20 via-[#caf0f8]/20 to-transparent blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-gradient-to-tr from-[#90e0ef]/20 via-[#00b4d8]/20 to-transparent blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-[1250px] mx-auto relative z-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-6 space-y-7 text-left">
              {/* Floating Pill Tag */}
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/20 border border-white/40 backdrop-blur-md text-white text-xs font-bold tracking-wider uppercase shadow-md">
                <span className="w-2 h-2 rounded-full bg-white" />
                Our Story & Business Impact
              </div>

              {/* Headline */}
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] font-serif text-white">
                From a Street Stall to <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-white via-[#caf0f8] to-white bg-clip-text text-transparent drop-shadow-sm">
                  6 Flourishing Branches
                </span>
              </h2>

              {/* Story Narrative */}
              <p className="text-white/95 text-sm sm:text-base leading-relaxed font-normal">
                Founded with a deep passion for authentic Filipino culinary traditions, <strong className="text-[#caf0f8] font-bold">Seafudz Ng Bayan</strong> started as a modest neighborhood setup. Driven by our signature butter garlic and Cajun boils, we grew into a multi-branch seafood destination beloved by seafood enthusiasts across the region.
              </p>

              <p className="text-[#caf0f8] text-xs sm:text-sm leading-relaxed border-l-4 border-white pl-4 italic font-medium bg-black/20 py-3 rounded-r-xl border-t border-b border-r border-white/20 shadow-sm backdrop-blur-md">
                "By maintaining direct daily partnerships with local coastal fishermen and enforcing zero-compromise freshness, we ensure every bilao serves ocean sweetness straight to your family's table."
              </p>

              {/* Glowing Impact Stats Cards */}
              <div className="pt-2 grid grid-cols-3 gap-4">
                <div className="group bg-white/90 backdrop-blur-xl border border-white/70 p-5 rounded-2xl hover:border-white shadow-[0_15px_35px_rgba(0,0,0,0.1)]">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0077b6] font-serif block group-hover:scale-105 transition-transform">
                    250K+
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[#03045e] uppercase tracking-widest font-mono font-bold block mt-1">
                    Bilaos Served
                  </span>
                </div>

                <div className="group bg-white/90 backdrop-blur-xl border border-white/70 p-5 rounded-2xl hover:border-white shadow-[0_15px_35px_rgba(0,0,0,0.1)]">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#00b4d8] font-serif block group-hover:scale-105 transition-transform">
                    6
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[#03045e] uppercase tracking-widest font-mono font-bold block mt-1">
                    Active Branches
                  </span>
                </div>

                <div className="group bg-white/90 backdrop-blur-xl border border-white/70 p-5 rounded-2xl hover:border-white shadow-[0_15px_35px_rgba(0,0,0,0.1)]">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0077b6] font-serif block group-hover:scale-105 transition-transform">
                    50+
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[#03045e] uppercase tracking-widest font-mono font-bold block mt-1">
                    Local Fishermen
                  </span>
                </div>
              </div>
            </div>

            {/* Right Interactive Milestone Cards Grid */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 lg:pt-0">
              {/* Milestone 1 */}
              <div className="group bg-white/90 backdrop-blur-xl p-7 rounded-3xl border border-white/70 text-left hover:border-white shadow-[0_15px_35px_rgba(0,0,0,0.1)] relative overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-[#00b4d8]/15 border border-[#00b4d8]/30 text-[#0077b6] flex items-center justify-center text-xs font-bold font-mono mb-4 group-hover:bg-[#0077b6] group-hover:text-white">
                  01
                </div>
                <span className="text-[11px] font-mono text-[#0077b6] font-bold tracking-widest block mb-1">
                  2021 • THE HUMBLE BEGINNING
                </span>
                <h4 className="text-lg font-bold text-[#03045e] mb-2 group-hover:text-[#0077b6] font-serif">
                  First Street Stall
                </h4>
                <p className="text-xs text-neutral-600 leading-relaxed font-normal">
                  Started in a small neighborhood setup with 1 signature Cajun sauce recipe and a vision to serve affordable fresh seafood.
                </p>
              </div>

              {/* Milestone 2 */}
              <div className="group bg-white/90 backdrop-blur-xl p-7 rounded-3xl border border-white/70 text-left hover:border-white shadow-[0_15px_35px_rgba(0,0,0,0.1)] relative overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-[#00b4d8]/15 border border-[#00b4d8]/30 text-[#0096c7] flex items-center justify-center text-xs font-bold font-mono mb-4 group-hover:bg-[#0096c7] group-hover:text-white">
                  02
                </div>
                <span className="text-[11px] font-mono text-[#0096c7] font-bold tracking-widest block mb-1">
                  2022 • EXPANSION
                </span>
                <h4 className="text-lg font-bold text-[#03045e] mb-2 group-hover:text-[#0096c7] font-serif">
                  Bilao Feast Concept
                </h4>
                <p className="text-xs text-neutral-600 leading-relaxed font-normal">
                  Pioneered large family-style bilao seafood platters, expanding rapidly to 3 main branches across the bay area.
                </p>
              </div>

              {/* Milestone 3 */}
              <div className="group bg-white/90 backdrop-blur-xl p-7 rounded-3xl border border-white/70 text-left hover:border-white shadow-[0_15px_35px_rgba(0,0,0,0.1)] relative overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-[#00b4d8]/15 border border-[#00b4d8]/30 text-[#0077b6] flex items-center justify-center text-xs font-bold font-mono mb-4 group-hover:bg-[#0077b6] group-hover:text-white">
                  03
                </div>
                <span className="text-[11px] font-mono text-[#0077b6] font-bold tracking-widest block mb-1">
                  2024 • DIGITAL TRANSFORMATION
                </span>
                <h4 className="text-lg font-bold text-[#03045e] mb-2 group-hover:text-[#0077b6] font-serif">
                  Cloud POS & Express Delivery
                </h4>
                <p className="text-xs text-neutral-600 leading-relaxed font-normal">
                  Integrated real-time kitchen tracking & online ordering system, guaranteeing hot delivery within 30 minutes.
                </p>
              </div>

              {/* Milestone 4 */}
              <div className="group bg-white/90 backdrop-blur-xl p-7 rounded-3xl border border-white/70 text-left hover:border-white shadow-[0_15px_35px_rgba(0,0,0,0.1)] relative overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-[#00b4d8]/15 border border-[#00b4d8]/30 text-[#0096c7] flex items-center justify-center text-xs font-bold font-mono mb-4 group-hover:bg-[#0096c7] group-hover:text-white">
                  04
                </div>
                <span className="text-[11px] font-mono text-[#0096c7] font-bold tracking-widest block mb-1">
                  TODAY & BEYOND
                </span>
                <h4 className="text-lg font-bold text-[#03045e] mb-2 group-hover:text-[#0096c7] font-serif">
                  6 Branches & Growing
                </h4>
                <p className="text-xs text-neutral-600 leading-relaxed font-normal">
                  Proudly employing local staff and supporting coastal fishing communities with every bilao order.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seafood Archive Section */}
      <div
        id="seafood-archive"
        className="py-28 px-6 md:px-[8%] bg-gradient-to-b from-[#0081a7] via-25% via-[#002d3c] to-[#001a24] text-white relative overflow-hidden z-30"
      >


        {/* Subtle ambient spotlight background effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-[#94d2bd]/20 via-[#0a9396]/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-[1200px] mx-auto relative z-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14 pb-8 border-b border-white/20">
            <div>
              <span className="text-[11px] font-medium tracking-[0.25em] text-[#e4dec3] uppercase block mb-2 font-mono">
                Exhibition Gallery
              </span>
              <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white font-serif">
                Seafood Archive
              </h2>
            </div>
          </div>

          {/* Accordion Gallery UI (ReactBits GSAP Component) */}
          <div className="w-full">
            <AccordionGallery
              items={ARCHIVED_ITEMS.map(item => ({
                image: item.image,
                label: `${item.name} (${item.yearArchived})`,
                alt: item.name
              }))}
              accentColor="#94d2bd"
              overlayColor="#002d3c"
              height={620}
              radius={24}
              tilt={6}
              grayscale={false}
              trigger="hover"
            />
          </div>

          {/* Museum Exhibition Lightbox Preview */}
          {selectedItem && (
            <div
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 fade-in"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#002d3c] border border-[#0a9396]/40 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative text-left zoom-in-95"
              >
                <div className="relative h-80 md:h-96 bg-black">
                  <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#002d3c] via-transparent to-transparent"></div>

                  <button
                    onClick={() => setSelectedItem(null)}
                    className="absolute top-4 right-4 bg-black/70 text-neutral-400 hover:text-white rounded-full w-8 h-8 flex items-center justify-center border border-neutral-800 text-xs cursor-pointer"
                  >
                    ✕
                  </button>

                  <div className="absolute bottom-4 left-6 right-6">
                    <span className="text-[10px] font-mono tracking-widest text-[#94d2bd] uppercase block mb-1">
                      Archive Exhibit • {selectedItem.yearArchived}
                    </span>
                    <h3 className="text-2xl md:text-3xl font-serif text-white">{selectedItem.name}</h3>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-4">
                  <p className="text-sm text-neutral-200 font-serif leading-relaxed italic border-l-2 border-[#94d2bd] pl-4">
                    "{selectedItem.description}"
                  </p>

                  <div className="flex items-center justify-between text-xs text-neutral-300 pt-4 border-t border-white/10 font-mono">
                    <span>CATEGORY: {selectedItem.category.toUpperCase()}</span>
                    <span>STATUS: {selectedItem.status.toUpperCase()}</span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="bg-[#0a9396] text-white hover:bg-[#005f73] text-xs font-semibold px-6 py-2.5 rounded-xl cursor-pointer"
                    >
                      Close Exhibit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rich Gradient Transition Block Between Seafood Archive and FAQ Section */}
      <div className="w-full h-44 bg-gradient-to-b from-[#001a24] via-[#00121b] to-[#000a12] pointer-events-none relative z-20" />

      {/* Frequently Asked Questions Section (Deep Abyss Gradient) */}
      <section id="faq-section" className="py-28 px-6 md:px-[8%] bg-gradient-to-b from-[#000a12] via-[#00060c] to-[#000206] text-white relative overflow-hidden z-20">
        <div className="max-w-[1250px] mx-auto relative z-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start relative">
            {/* Left Column: Sticky Title & Subtitle Header */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4 text-left">
              <span className="text-xs font-semibold tracking-widest text-[#94d2bd] uppercase block">
                Got Questions?
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight font-serif">
                Frequently Asked Questions
              </h2>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-md pt-2">
                Everything you need to know about our seafood bilao orders, delivery coverage, and catering services.
              </p>

              <div className="pt-6 hidden lg:block">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/10 border border-[#94d2bd]/30 backdrop-blur-md text-[#94d2bd] text-xs font-medium font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#94d2bd]" />
                  Scroll to view stacked answers
                </div>
              </div>
            </div>

            {/* Right Column: ReactBits ClickStack Component */}
            <div className="lg:col-span-7 text-left relative min-h-[480px]">
              <ClickStack
                items={FAQ_ITEMS.map((item, index) => ({
                  id: `faq-${index}`,
                  title: item.question,
                  content: item.answer,
                  subtitle: `FAQ EXHIBIT 0${index + 1}`,
                  badge: `0${index + 1}`
                }))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Branch Locations & Exclusive Offerings Section (Seamless Deep Navy Flow) */}
      <section className="py-28 px-6 md:px-[8%] bg-gradient-to-b from-[#00060a] via-[#000c14] to-[#00141d] text-white relative overflow-hidden z-10">
        {/* Smooth Gradient Blend Overlay merging from FAQ Section */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-[#00060a] via-[#00060a]/60 to-transparent pointer-events-none z-10" />

        <div className="max-w-[1200px] mx-auto text-center relative z-20">
          <span className="text-xs font-semibold tracking-widest text-[#94d2bd] uppercase mb-2 block font-mono">
            New Horizon • Coming Soon
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-serif">
            Branch Locations & Exclusive Offerings
          </h2>
          <p className="text-sm md:text-base text-neutral-300 max-w-2xl mx-auto mb-12 leading-relaxed">
            Stay tuned for our upcoming branch locator, live table reservation system, and seasonal seafood tasting experiences across Metro Manila.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-[#001e28]/90 border border-[#0a9396]/30 p-8 rounded-2xl hover:border-[#94d2bd]">
              <span className="text-xs font-mono text-[#94d2bd] font-bold block mb-2">01 • MAIN BRANCH</span>
              <h3 className="text-xl font-bold text-white mb-2">Seafudz Central Bay</h3>
              <p className="text-xs text-neutral-300">Harbor Drive, Manila Bay Shoreline. Open daily from 10:00 AM to 10:00 PM.</p>
            </div>

            <div className="bg-[#001e28]/90 border border-[#0a9396]/30 p-8 rounded-2xl hover:border-[#94d2bd]">
              <span className="text-xs font-mono text-[#e4dec3] font-bold block mb-2">02 • EXPRESS HUB</span>
              <h3 className="text-xl font-bold text-white mb-2">Quezon City Hub</h3>
              <p className="text-xs text-neutral-300">Timog Avenue, Quezon City. Express Bilao Dispatch & Cloud Kitchen POS.</p>
            </div>

            <div className="bg-[#001e28]/90 border border-[#0a9396]/30 p-8 rounded-2xl hover:border-[#94d2bd]">
              <span className="text-xs font-mono text-[#94d2bd] font-bold block mb-2">03 • SOUTH BRANCH</span>
              <h3 className="text-xl font-bold text-white mb-2">Alabang Coastal</h3>
              <p className="text-xs text-neutral-300">Filinvest City, Alabang. Family Dining & Outdoor Cajun Boil Pavilion.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Landing Page Footer Component */}
      <Footer />
    </div>
  );
};

/* FAQ Items Data */
const FAQ_ITEMS = [
  {
    question: "How far in advance should I order a Seafood Bilao?",
    answer: "For regular bilao orders, we recommend ordering at least 1-2 hours before your intended mealtime. For large family feasts, bulk orders, or holiday peak seasons, booking 1 day in advance is highly encouraged to guarantee your preferred time slot."
  },
  {
    question: "What delivery coverage area do you support?",
    answer: "We deliver across Metro Manila and neighboring key areas surrounding our 6 branches! Orders are dispatched using thermal insulated packaging to ensure your seafood arrives piping hot and fresh."
  },
  {
    question: "Can I customize the items inside my Seafood Bilao?",
    answer: "Yes! You can choose your preferred spice level (Original Garlic Butter, Cajun Mild, Spicy Extra Hot) and add extra items like extra Crabs, Shrimp, Tahong, Sweet Corn, or Garlic Rice directly during checkout."
  },
  {
    question: "Do you offer catering services for events and parties?",
    answer: "Absolutely! We cater for birthdays, corporate events, and family gatherings with custom seafood boil stations, live cooking setups, and large-scale bilao packages. Contact our team via the Order Online portal for catering inquiries."
  },
  {
    question: "How do I ensure my seafood stays fresh if consuming later?",
    answer: "If not consuming immediately upon delivery, keep the bilao sealed in its thermal wrap. You can reheat seafood boils in a microwave or skillet with a splash of butter on medium heat for 2-3 minutes."
  }
];

export default LandingPage;
