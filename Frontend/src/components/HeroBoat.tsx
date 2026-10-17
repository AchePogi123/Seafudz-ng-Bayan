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
        <ellipse cx="160" cy="181" rx="104" ry="9" fill="#7D3300" fillOpacity=".24" />
        <g className="hero-boat-motion">
          <path d="M86 119 39 103M234 119l47-16" stroke="#F5D49F" strokeWidth="6" strokeLinecap="round" />
          <path d="M16 101q24 15 48 0l-7 12q-18 9-35 0Z" fill="#16495A" />
          <path d="M256 101q24 15 48 0l-6 12q-18 9-35 0Z" fill="#16495A" />
          <path d="M71 119h178l-29 43q-60 22-120 0Z" fill="#16394B" />
          <path d="M86 147h148l-14 21q-60 18-120 0Z" fill="#0B6975" />
          <path d="M75 116h170l10 14H65Z" fill="#F2B967" />
          <path d="M119 75h82l19 41H100Z" fill="#FFF3D9" />
          <path d="M111 74h94l-8 12h-78Z" fill="#16495A" />
          <path d="M126 90h24v19h-24Zm34 0h24v19h-24Z" fill="#0D5968" />
          <path d="M155 50v26" stroke="#F5D49F" strokeWidth="4" strokeLinecap="round" />
          <path d="M145 51h21" stroke="#F5D49F" strokeWidth="4" strokeLinecap="round" />
          <path d="M75 133h170" stroke="#FF6900" strokeWidth="4" strokeLinecap="round" />
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
