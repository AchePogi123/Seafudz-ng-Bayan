import React, { useState, useRef, useEffect } from 'react'

interface HeroBoatProps {
  className?: string
  onClick?: () => void
}

export const HeroBoat: React.FC<HeroBoatProps> = ({ className = '', onClick }) => {
  const [boatSceneKey, setBoatSceneKey] = useState(0)
  const [isBoatSceneActive, setIsBoatSceneActive] = useState(false)
  const boatSceneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (boatSceneTimer.current) clearTimeout(boatSceneTimer.current)
    }
  }, [])

  const animateBoatScene = () => {
    setBoatSceneKey((key) => key + 1)
    setIsBoatSceneActive(true)
    if (boatSceneTimer.current) clearTimeout(boatSceneTimer.current)
    boatSceneTimer.current = setTimeout(() => {
      setIsBoatSceneActive(false)
      boatSceneTimer.current = null
    }, 2600)
    onClick?.()
  }

  return (
    <button
      type="button"
      onClick={animateBoatScene}
      aria-label="Make the boat sail with birds and swimming fish"
      className={`group relative cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
    >
      <svg
        className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04] active:scale-95"
        viewBox="0 0 320 220"
        fill="none"
        aria-hidden="true"
      >
        {/* Warm horizon sun disk behind the banca */}
        <circle cx="160" cy="126" r="70" fill="#FFF7ED" fillOpacity=".12" />
        <circle cx="160" cy="126" r="48" fill="#FFF7ED" fillOpacity=".15" />

        <g className="hero-boat-motion">
          {/* Curved outrigger booms (katig) arching down from the hull to the water surface */}
          <path
            d="M84 142 C 66 142 52 152 38 164 M236 142 C 254 142 268 152 282 164"
            stroke="#F5D49F"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M84 141 C 66 141 52 151 38 163 M236 141 C 254 141 268 151 282 163"
            stroke="#FFF3D9"
            strokeOpacity=".6"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Outrigger floats resting on the waterline */}
          <path d="M14 162q24 11 48 0l-6 10q-18 7-36 0Z" fill="#16495A" />
          <path d="M258 162q24 11 48 0l-6 10q-18 7-36 0Z" fill="#16495A" />

          {/* Main hull positioned in the water plane */}
          <path d="M71 137h178l-29 43q-60 22-120 0Z" fill="#16394B" />
          <path d="M86 165h148l-14 21q-60 18-120 0Z" fill="#0B6975" />

          {/* Gunwale deck */}
          <path d="M75 134h170l10 14H65Z" fill="#F2B967" />
          <path d="M76 135h168" stroke="#FFF3D9" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />

          {/* Cabin house & roof */}
          <path d="M119 93h82l19 41H100Z" fill="#FFF3D9" />
          <path d="M111 92h94l-8 12h-78Z" fill="#16495A" />
          <path d="M113 93h90" stroke="#F5D49F" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />

          {/* Cabin windows with subtle glass reflection */}
          <path d="M126 108h24v19h-24Zm34 0h24v19h-24Z" fill="#0D5968" />
          <path d="M129 111h7l-5 13h-2Zm34 0h7l-5 13h-2Z" fill="#FFF3D9" fillOpacity=".18" />

          {/* Mast, crossbar & fluttering coastal pennant */}
          <path d="M155 66v27" stroke="#F5D49F" strokeWidth="4" strokeLinecap="round" />
          <path d="M145 70h21" stroke="#F5D49F" strokeWidth="3.5" strokeLinecap="round" />
          <path className="hero-boat-pennant" d="M157 65l15 4-15 4Z" fill="#FF6900" />

          {/* Signature orange hull stripe */}
          <path d="M75 151h170" stroke="#FF6900" strokeWidth="4" strokeLinecap="round" />

          {/* Buoyant waterline foam & contact ripples hugging the submerged hull and outriggers */}
          <g className="hero-boat-waterline" stroke="#FFF7ED" strokeLinecap="round">
            <path d="M78 176 Q 118 184 160 180 T 242 176" strokeOpacity=".78" strokeWidth="2.4" />
            <path d="M14 170 Q 38 175 62 170 M258 170 Q 282 175 306 170" strokeOpacity=".65" strokeWidth="2" />
          </g>
        </g>

        {/* Minimal water wake reflection beneath the hull */}
        <g className="hero-boat-waves" stroke="#FFF7ED" strokeLinecap="round">
          <path d="M62 190q24-4 48 0t48 0 48 0 48 0" strokeOpacity=".52" strokeWidth="1.9" />
          <path d="M90 201q18-3 36 0t36 0 36 0 36 0" strokeOpacity=".34" strokeWidth="1.5" />
        </g>

        {isBoatSceneActive && (
          <g key={boatSceneKey}>
            <g className="hero-bird hero-bird-one" fill="none" stroke="#FFF5E7" strokeWidth="3" strokeLinecap="round">
              <path d="M208 56q7-9 14 0 7-9 14 0" />
            </g>
            <g className="hero-bird hero-bird-two" fill="none" stroke="#FFF5E7" strokeWidth="2.5" strokeLinecap="round">
              <path d="M234 39q6-7 12 0 6-7 12 0" />
            </g>
            <g className="hero-bird hero-bird-three" fill="none" stroke="#FFF5E7" strokeWidth="2" strokeLinecap="round">
              <path d="M183 43q5-6 10 0 5-6 10 0" />
            </g>
            <g className="hero-fish hero-fish-one" stroke="#16495A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M83 194c7-8 18-11 29-7l10 7-10 7c-11 4-22 1-29-7Z" fill="#FFF3D9" />
              <path d="m83 194-11-8v16Z" fill="#F5D49F" />
              <path d="m96 187 5-7 5 9m-9 12 5 7 5-9" fill="#F5D49F" />
              <path d="M100 188q6 6 0 12m-9-8 4 2m-4 2 4 1" fill="none" />
              <circle cx="114" cy="191" r="1.7" fill="#16495A" stroke="none" />
            </g>
            <g className="hero-fish hero-fish-two" stroke="#16495A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M237 204c-7-8-18-10-28-6l-10 7 10 7c10 4 21 1 28-8Z" fill="#F5D49F" />
              <path d="m237 205 11-8v16Z" fill="#FFF3D9" />
              <path d="m224 198-5-7-5 9m9 11-5 7-5-9" fill="#FFF3D9" />
              <path d="M220 199q-6 6 0 12m9-8-4 2m4 2-4 1" fill="none" />
              <circle cx="204" cy="201" r="1.7" fill="#16495A" stroke="none" />
            </g>
          </g>
        )}
      </svg>
    </button>
  )
}

export default HeroBoat
