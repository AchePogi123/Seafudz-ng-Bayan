import React from 'react'
import { Link } from 'react-router-dom'

// Import assets
import seafoodBilaoImg from '../assets/seafood_bilao.png'
import seafoodCajunImg from '../assets/seafood_cajun.png'
import spicyShrimpImg from '../assets/spicy_shrimp.png'
import crabBucketImg from '../assets/crab_bucket.png'
import garlicButterShrimpImg from '../assets/garlic_butter_shrimp.png'
import freshJuiceImg from '../assets/fresh_juice.png'

const AboutUs: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <nav className="bg-white py-[15px] px-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex justify-between items-center">
        <div className="text-[22px] font-bold text-[#ff7b00]">Seafood ng Bayan</div>
        <div className="flex gap-[25px]">
          <Link to="/pos" className="no-underline text-[#333] font-semibold hover:text-[#ff7b00]">POS</Link>
          <Link to="/customer" className="no-underline text-[#333] font-semibold hover:text-[#ff7b00]">Order Online</Link>
          <Link to="/about" className="no-underline font-semibold text-[#ff7b00]">About Us</Link>
        </div>
        <Link to="/customer" className="bg-[#ff7b00] text-white py-[8px] px-[20px] rounded-[30px] no-underline font-bold transition-all hover:bg-[#e06c00]">Order Now</Link>
      </nav>

      <div className="py-[40px] px-[24px] max-w-[1200px] mx-auto">
        <h1 className="text-[36px] text-center mb-[40px] text-[#ff7b00] font-extrabold">About Us</h1>

        <div className="mb-[60px]">
          <h2 className="text-[28px] mb-[20px] text-[#ff7b00] text-center font-bold">Our Story</h2>
          <p className="max-w-[800px] mx-auto mb-[30px] text-[17px] leading-[1.8] text-center text-gray-600">
            Founded in 2026, Seafood ng Bayan started with a simple vision: to bring the ocean's finest bounties straight to your table. We work closely with local fishermen to source sustainable, premium seafood daily, ensuring the highest quality in every dish we serve.
          </p>
        </div>

        <div className="mb-[60px]">
          <h2 className="text-[28px] mb-[20px] text-[#ff7b00] text-center font-bold">Our Mission</h2>
          <p className="max-w-[800px] mx-auto mb-[30px] text-[17px] leading-[1.8] text-center text-gray-600">
            We strive to combine authentic local culinary traditions with modern standards of preparation and convenience. From our signature Cajun boil buckets to our traditional Bilaos, we aim to make high-quality seafood accessible and enjoyable for every family.
          </p>
        </div>

        <div className="mb-[60px]">
          <h2 className="text-[28px] mb-[20px] text-[#ff7b00] text-center font-bold">Our Gallery</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[15px] mt-[30px]">
            <img src={seafoodBilaoImg} alt="Seafood Bilao" className="w-full h-[220px] object-cover rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]" />
            <img src={seafoodCajunImg} alt="Cajun Seafood" className="w-full h-[220px] object-cover rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]" />
            <img src={spicyShrimpImg} alt="Spicy Shrimp" className="w-full h-[220px] object-cover rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]" />
            <img src={crabBucketImg} alt="Crab Bucket" className="w-full h-[220px] object-cover rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]" />
            <img src={garlicButterShrimpImg} alt="Garlic Butter Shrimp" className="w-full h-[220px] object-cover rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]" />
            <img src={freshJuiceImg} alt="Fresh Juice" className="w-full h-[220px] object-cover rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AboutUs

