export interface GeoCoordinate {
  lat: number
  lng: number
  label?: string
}

export interface DeliveryJob {
  id: string
  ref: string
  customerId?: string
  userId?: string
  tripId?: string
  customer: string
  phone: string
  address: string
  items: Array<{ name: string; quantity: number }>
  total: number
  deliveryFee?: number | null
  status: 'Ready' | 'Out for Delivery' | 'Completed' | 'Preparing' | string
  createdAt?: string
  paymentMethod?: string
  coord: GeoCoordinate
  roadDistanceKm?: number
  riderCashReceived?: number
  deliveryProof?: string
}

// Store location: Barangay 176, Bagong Silang, Caloocan
export const SEAFUDZ_FLAGSHIP_STORE: GeoCoordinate = {
  lat: 14.762,
  lng: 121.045,
  label: 'Seafudz ng Bayan - Barangay 176, Bagong Silang',
}

export function calculateDeliveryFee(distanceKm: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 8) return null
  return distanceKm < 3.9 ? 50 : 100
}

/**
 * 2. Metro Manila Geo-Directory & Address Parser
 * Automatically maps unstructured Filipino addresses to verified latitude & longitude.
 * No Google Geocoding API keys required!
 */
export const METRO_MANILA_LOCATIONS: Record<string, GeoCoordinate> = {
  // Caloocan & CAMANAVA (Near Flagship Store)
  'monumento': { lat: 14.6565, lng: 120.9835, label: 'Monumento, Caloocan' },
  'grace park': { lat: 14.6495, lng: 120.9880, label: 'Grace Park, Caloocan' },
  'bagong barrio': { lat: 14.6582, lng: 120.9985, label: 'Bagong Barrio, Caloocan' },
  'sangandaan': { lat: 14.6540, lng: 120.9702, label: 'Sangandaan, Caloocan' },
  'caloocan north': { lat: 14.7380, lng: 121.0390, label: 'North Caloocan (Camarin/Bagong Silang)' },
  'camarin': { lat: 14.7450, lng: 121.0410, label: 'Camarin, Caloocan North' },
  'bagong silang': { lat: 14.7620, lng: 121.0450, label: 'Bagong Silang, Caloocan' },
  'malabon': { lat: 14.6625, lng: 120.9570, label: 'Malabon City Center' },
  'potrero': { lat: 14.6650, lng: 120.9790, label: 'Potrero, Malabon' },
  'navotas': { lat: 14.6680, lng: 120.9420, label: 'Navotas Fish Port' },
  'valenzuela': { lat: 14.6937, lng: 120.9630, label: 'Valenzuela City Hall' },
  'karuhatan': { lat: 14.6880, lng: 120.9780, label: 'Karuhatan, Valenzuela' },
  'marulas': { lat: 14.6750, lng: 120.9850, label: 'Marulas, Valenzuela' },

  // Quezon City
  'balintawak': { lat: 14.6575, lng: 121.0020, label: 'Balintawak, Quezon City' },
  'sm north': { lat: 14.6560, lng: 121.0310, label: 'SM North / Trinoma, QC' },
  'quezon avenue': { lat: 14.6405, lng: 121.0210, label: 'Quezon Avenue, QC' },
  'diliman': { lat: 14.6538, lng: 121.0685, label: 'Diliman / UP, Quezon City' },
  'cubao': { lat: 14.6200, lng: 121.0530, label: 'Araneta City Cubao, QC' },
  'novaliches': { lat: 14.7215, lng: 121.0380, label: 'Novaliches Bayan, QC' },
  'fairview': { lat: 14.7080, lng: 121.0670, label: 'Fairview, Quezon City' },

  // Manila
  'tondo': { lat: 14.6150, lng: 120.9700, label: 'Tondo, Manila' },
  'binondo': { lat: 14.6000, lng: 120.9750, label: 'Binondo Chinatown, Manila' },
  'sta cruz': { lat: 14.6100, lng: 120.9850, label: 'Sta. Cruz, Manila' },
  'sampaloc': { lat: 14.6120, lng: 121.0010, label: 'Sampaloc / UST, Manila' },
  'quiapo': { lat: 14.5995, lng: 120.9840, label: 'Quiapo, Manila' },
  'ermita': { lat: 14.5800, lng: 120.9850, label: 'Ermita / Malate, Manila' },

  // Other Metro Manila Hubs
  'san juan': { lat: 14.6040, lng: 121.0330, label: 'Greenhills, San Juan' },
  'mandaluyong': { lat: 14.5794, lng: 121.0359, label: 'Mandaluyong City' },
  'pasig': { lat: 14.5764, lng: 121.0851, label: 'Pasig City' },
  'makati': { lat: 14.5547, lng: 121.0244, label: 'Makati CBD' },
  'bgc': { lat: 14.5490, lng: 121.0500, label: 'Bonifacio Global City, Taguig' },
  'taguig': { lat: 14.5200, lng: 121.0550, label: 'Taguig City' },
  'pasay': { lat: 14.5378, lng: 120.9990, label: 'Pasay City' },

  // Adjacent provinces & cities (Beyond 8 km road limit)
  'bulacan': { lat: 14.8527, lng: 120.8160, label: 'Bulacan Province' },
  'malolos': { lat: 14.8527, lng: 120.8160, label: 'Malolos, Bulacan' },
  'marilao': { lat: 14.7570, lng: 120.9480, label: 'Marilao, Bulacan' },
  'meycauayan': { lat: 14.7350, lng: 120.9600, label: 'Meycauayan, Bulacan' },
  'san jose del monte': { lat: 14.8130, lng: 121.0450, label: 'San Jose del Monte, Bulacan' },
  'sjdm': { lat: 14.8130, lng: 121.0450, label: 'San Jose del Monte, Bulacan' },
  'bocaue': { lat: 14.8000, lng: 120.9300, label: 'Bocaue, Bulacan' },
  'santa maria': { lat: 14.8200, lng: 120.9600, label: 'Santa Maria, Bulacan' },
  'norzagaray': { lat: 14.9100, lng: 121.0500, label: 'Norzagaray, Bulacan' },
  'cavite': { lat: 14.4791, lng: 120.8969, label: 'Cavite' },
  'laguna': { lat: 14.2800, lng: 121.4200, label: 'Laguna' },
  'rizal': { lat: 14.6000, lng: 121.3000, label: 'Rizal' },
  'antipolo': { lat: 14.5842, lng: 121.1763, label: 'Antipolo, Rizal' },
  'pampanga': { lat: 15.0333, lng: 120.6833, label: 'Pampanga' },
}

/**
 * Searches the calibrated Metro Manila & surrounding area dictionary for a match.
 * Returns null if not in the known dictionary.
 */
export function matchKnownLocation(addressText: string): GeoCoordinate | null {
  const normalized = (addressText || '').toLowerCase()

  for (const [key, coord] of Object.entries(METRO_MANILA_LOCATIONS)) {
    if (normalized.includes(key)) {
      const hash = addressText.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      const latOffset = ((hash % 100) - 50) * 0.00008
      const lngOffset = (((hash >> 2) % 100) - 50) * 0.00008
      return {
        lat: Number((coord.lat + latOffset).toFixed(6)),
        lng: Number((coord.lng + lngOffset).toFixed(6)),
        label: coord.label,
      }
    }
  }

  return null
}

/**
 * Resolves any customer text address to approximate coordinates.
 * Falls back to an offset from Caloocan store if not specifically matched.
 */
export function geocodeAddress(addressText: string): GeoCoordinate {
  const match = matchKnownLocation(addressText)
  if (match) return match

  // Fallback: Generate reasonable Metro Manila coordinate nearby (for simulations)
  const hash = addressText.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const latOffset = (((hash % 200) - 100) / 100) * 0.03
  const lngOffset = ((((hash * 3) % 200) - 100) / 100) * 0.03

  return {
    lat: Number((SEAFUDZ_FLAGSHIP_STORE.lat + latOffset).toFixed(6)),
    lng: Number((SEAFUDZ_FLAGSHIP_STORE.lng + lngOffset).toFixed(6)),
    label: addressText.trim() || 'Metro Manila Area',
  }
}
