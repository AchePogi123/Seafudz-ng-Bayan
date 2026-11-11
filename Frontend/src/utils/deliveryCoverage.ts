/**
 * Store Delivery Coverage Utility (Max 8 km Radius)
 *
 * Store Location:
 * SEAFUDZ NG BAYAN by Noodlelicious
 * Barangay 176 (Bagong Silang), Caloocan, Metro Manila
 * Coordinates: 14.7620° N, 121.0450° E
 */

export interface DeliverableBarangay {
  id: string;
  name: string;
  city: string;
  cityGroup: 'Caloocan North' | 'Quezon City (Novaliches & Fairview)' | 'San Jose del Monte, Bulacan' | 'Valenzuela';
  lat: number;
  lng: number;
  distanceKm: number;
}

export const STORE_FLAGSHIP_LOCATION = {
  name: 'SEAFUDZ NG BAYAN by Noodlelicious',
  barangay: 'Barangay 176 (Bagong Silang)',
  city: 'Caloocan City',
  region: 'Metro Manila',
  lat: 14.7620,
  lng: 121.0450,
  maxRadiusKm: 8.0,
};

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Verified administrative barangays and districts within 8 km of
 * SEAFUDZ NG BAYAN Flagship Store in Barangay 176 (Bagong Silang), Caloocan.
 */
export const DELIVERABLE_BARANGAYS_8KM: DeliverableBarangay[] = [
  // --- Caloocan North (Immediate Store Territory) ---
  {
    id: 'cal-176',
    name: 'Barangay 176 (Bagong Silang - Phases 1 to 10)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7620,
    lng: 121.0450,
    distanceKm: 0.0,
  },
  {
    id: 'cal-177',
    name: 'Barangay 177 (Camarin / Cielito Homes)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7510,
    lng: 121.0435,
    distanceKm: 1.23,
  },
  {
    id: 'cal-180',
    name: 'Barangay 180 (Tala / Malaria)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7640,
    lng: 121.0610,
    distanceKm: 1.73,
  },
  {
    id: 'cal-178',
    name: 'Barangay 178 (Camarin / Kiko)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7455,
    lng: 121.0395,
    distanceKm: 1.93,
  },
  {
    id: 'cal-175',
    name: 'Barangay 175 (Camarin)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7480,
    lng: 121.0330,
    distanceKm: 2.02,
  },
  {
    id: 'cal-179',
    name: 'Barangay 179 (Amparo Village)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7570,
    lng: 121.0660,
    distanceKm: 2.33,
  },
  {
    id: 'cal-185',
    name: 'Barangay 185 (Malaria)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7540,
    lng: 121.0700,
    distanceKm: 2.83,
  },
  {
    id: 'cal-181',
    name: 'Barangay 181 (Pangarap Village)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7690,
    lng: 121.0710,
    distanceKm: 2.90,
  },
  {
    id: 'cal-173',
    name: 'Barangay 173 (Congress Village)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7430,
    lng: 121.0250,
    distanceKm: 3.01,
  },
  {
    id: 'cal-172',
    name: 'Barangay 172 (Urduja / Congressional)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7395,
    lng: 121.0290,
    distanceKm: 3.04,
  },
  {
    id: 'cal-174',
    name: 'Barangay 174 (Urduja Village)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7360,
    lng: 121.0360,
    distanceKm: 3.05,
  },
  {
    id: 'cal-184',
    name: 'Barangay 184 (Tala)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7580,
    lng: 121.0740,
    distanceKm: 3.15,
  },
  {
    id: 'cal-171',
    name: 'Barangay 171 (Bagumbong)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7490,
    lng: 121.0180,
    distanceKm: 3.24,
  },
  {
    id: 'cal-182',
    name: 'Barangay 182 (Pangarap Village)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7720,
    lng: 121.0740,
    distanceKm: 3.31,
  },
  {
    id: 'cal-183',
    name: 'Barangay 183 (Midway Park / Tala)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7610,
    lng: 121.0780,
    distanceKm: 3.55,
  },
  {
    id: 'cal-186',
    name: 'Barangay 186 (Barracks / Tala)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7660,
    lng: 121.0800,
    distanceKm: 3.79,
  },
  {
    id: 'cal-187',
    name: 'Barangay 187 (Tala)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7600,
    lng: 121.0820,
    distanceKm: 3.98,
  },
  {
    id: 'cal-170',
    name: 'Barangay 170 (Deparo)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7320,
    lng: 121.0230,
    distanceKm: 4.09,
  },
  {
    id: 'cal-188',
    name: 'Barangay 188 (Tala)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7630,
    lng: 121.0860,
    distanceKm: 4.41,
  },
  {
    id: 'cal-169',
    name: 'Barangay 169 (BF Homes Caloocan)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7290,
    lng: 121.0180,
    distanceKm: 4.68,
  },
  {
    id: 'cal-168',
    name: 'Barangay 168 (Deparo)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7260,
    lng: 121.0140,
    distanceKm: 5.21,
  },
  {
    id: 'cal-167',
    name: 'Barangay 167 (Llano)',
    city: 'Caloocan City (North)',
    cityGroup: 'Caloocan North',
    lat: 14.7210,
    lng: 121.0050,
    distanceKm: 6.27,
  },

  // --- San Jose del Monte (SJDM), Bulacan (Direct Northern & Eastern Border) ---
  {
    id: 'sjdm-ciudad-real',
    name: 'Barangay Ciudad Real',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7730,
    lng: 121.0500,
    distanceKm: 1.34,
  },
  {
    id: 'sjdm-santo-cristo',
    name: 'Barangay Santo Cristo',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7820,
    lng: 121.0480,
    distanceKm: 2.25,
  },
  {
    id: 'sjdm-gumaoc',
    name: 'Barangay Gumaoc (West & East)',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7860,
    lng: 121.0530,
    distanceKm: 2.80,
  },
  {
    id: 'sjdm-graceville',
    name: 'Barangay Graceville',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7870,
    lng: 121.0380,
    distanceKm: 2.88,
  },
  {
    id: 'sjdm-san-manuel',
    name: 'Barangay San Manuel',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7820,
    lng: 121.0650,
    distanceKm: 3.09,
  },
  {
    id: 'sjdm-tungkong-mangga',
    name: 'Barangay Tungkong Mangga',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7890,
    lng: 121.0620,
    distanceKm: 3.51,
  },
  {
    id: 'sjdm-kaypian',
    name: 'Barangay Kaypian',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7950,
    lng: 121.0580,
    distanceKm: 3.93,
  },
  {
    id: 'sjdm-gaya-gaya',
    name: 'Barangay Gaya-Gaya',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7950,
    lng: 121.0320,
    distanceKm: 3.93,
  },
  {
    id: 'sjdm-muzon',
    name: 'Barangay Muzon',
    city: 'San Jose del Monte, Bulacan',
    cityGroup: 'San Jose del Monte, Bulacan',
    lat: 14.7990,
    lng: 121.0240,
    distanceKm: 4.69,
  },

  // --- Quezon City (Novaliches, Lagro, Fairview Border) ---
  {
    id: 'qc-pasong-putik',
    name: 'Barangay Pasong Putik Proper',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7370,
    lng: 121.0600,
    distanceKm: 3.21,
  },
  {
    id: 'qc-kaligayahan',
    name: 'Barangay Kaligayahan (Novaliches)',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7330,
    lng: 121.0480,
    distanceKm: 3.24,
  },
  {
    id: 'qc-novaliches-proper',
    name: 'Barangay Novaliches Proper (Bayan)',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7280,
    lng: 121.0390,
    distanceKm: 3.84,
  },
  {
    id: 'qc-santa-monica',
    name: 'Barangay Santa Monica (Novaliches)',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7240,
    lng: 121.0420,
    distanceKm: 4.24,
  },
  {
    id: 'qc-greater-lagro',
    name: 'Barangay Greater Lagro',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7260,
    lng: 121.0660,
    distanceKm: 4.60,
  },
  {
    id: 'qc-san-agustin',
    name: 'Barangay San Agustin (Novaliches)',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7210,
    lng: 121.0390,
    distanceKm: 4.60,
  },
  {
    id: 'qc-capri',
    name: 'Barangay Capri',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7220,
    lng: 121.0310,
    distanceKm: 4.70,
  },
  {
    id: 'qc-north-fairview',
    name: 'Barangay North Fairview',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7170,
    lng: 121.0600,
    distanceKm: 5.26,
  },
  {
    id: 'qc-nagkaisang-nayon',
    name: 'Barangay Nagkaisang Nayon',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7170,
    lng: 121.0260,
    distanceKm: 5.40,
  },
  {
    id: 'qc-gulod',
    name: 'Barangay Gulod',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7140,
    lng: 121.0360,
    distanceKm: 5.42,
  },
  {
    id: 'qc-sta-lucia',
    name: 'Barangay Sta. Lucia (Novaliches)',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7050,
    lng: 121.0490,
    distanceKm: 6.35,
  },
  {
    id: 'qc-fairview',
    name: 'Barangay Fairview',
    city: 'Quezon City',
    cityGroup: 'Quezon City (Novaliches & Fairview)',
    lat: 14.7080,
    lng: 121.0670,
    distanceKm: 6.45,
  },

  // --- Valenzuela (Eastern border with North Caloocan) ---
  {
    id: 'val-bignay',
    name: 'Barangay Bignay',
    city: 'Valenzuela City',
    cityGroup: 'Valenzuela',
    lat: 14.7320,
    lng: 120.9980,
    distanceKm: 6.06,
  },
  {
    id: 'val-punturin',
    name: 'Barangay Punturin',
    city: 'Valenzuela City',
    cityGroup: 'Valenzuela',
    lat: 14.7260,
    lng: 120.9920,
    distanceKm: 6.96,
  },
  {
    id: 'val-lawang-bato',
    name: 'Barangay Lawang Bato',
    city: 'Valenzuela City',
    cityGroup: 'Valenzuela',
    lat: 14.7180,
    lng: 120.9910,
    distanceKm: 7.59,
  },
];

/**
 * Groups deliverable barangays by city/district for clean <optgroup> rendering.
 */
export function getDeliverableBarangaysByGroup(): Record<string, DeliverableBarangay[]> {
  const groups: Record<string, DeliverableBarangay[]> = {
    'Caloocan North': [],
    'Quezon City (Novaliches & Fairview)': [],
    'San Jose del Monte, Bulacan': [],
    'Valenzuela': [],
  };

  DELIVERABLE_BARANGAYS_8KM.forEach((b) => {
    if (groups[b.cityGroup]) {
      groups[b.cityGroup].push(b);
    }
  });

  return groups;
}

/**
 * Finds the nearest deliverable barangay to given coordinates,
 * and checks if the point is strictly within the 8 km store delivery limit.
 */
export function findNearestDeliverableBarangay(lat: number, lng: number): {
  nearest: DeliverableBarangay | null;
  distanceToStoreKm: number;
  isWithinRadius: boolean;
} {
  const distanceToStoreKm = calculateDistanceKm(
    STORE_FLAGSHIP_LOCATION.lat,
    STORE_FLAGSHIP_LOCATION.lng,
    lat,
    lng
  );

  const isWithinRadius = distanceToStoreKm <= STORE_FLAGSHIP_LOCATION.maxRadiusKm;

  let nearest: DeliverableBarangay | null = null;
  let minDiff = Infinity;

  for (const b of DELIVERABLE_BARANGAYS_8KM) {
    const diff = calculateDistanceKm(lat, lng, b.lat, b.lng);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = b;
    }
  }

  return {
    nearest,
    distanceToStoreKm,
    isWithinRadius,
  };
}
