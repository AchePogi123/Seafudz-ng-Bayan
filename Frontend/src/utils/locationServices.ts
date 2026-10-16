export interface Coordinates {
  lat: number
  lng: number
}

export interface RoadDestination {
  id: string
  coord: Coordinates
}

const OSRM_BASE_URL = 'https://router.project-osrm.org'
const MAX_DESTINATIONS_PER_REQUEST = 99

export async function reverseGeocodeCoordinates({ lat, lng }: Coordinates): Promise<string> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: '18',
    addressdetails: '1',
  })
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Address lookup is temporarily unavailable.')

  const data = await response.json()
  if (typeof data.display_name !== 'string' || !data.display_name.trim()) {
    throw new Error('No street address was found for your current location.')
  }
  return data.display_name
}

export async function fetchRoadDistances(
  origin: Coordinates,
  destinations: RoadDestination[],
  signal?: AbortSignal
): Promise<Map<string, number>> {
  const distancesById = new Map<string, number>()

  for (let start = 0; start < destinations.length; start += MAX_DESTINATIONS_PER_REQUEST) {
    const batch = destinations.slice(start, start + MAX_DESTINATIONS_PER_REQUEST)
    const coordinates = [origin, ...batch.map(({ coord }) => coord)]
      .map(({ lat, lng }) => `${lng},${lat}`)
      .join(';')
    const destinationIndexes = batch.map((_, index) => index + 1).join(';')
    const params = new URLSearchParams({
      sources: '0',
      destinations: destinationIndexes,
      annotations: 'distance',
    })
    const response = await fetch(
      `${OSRM_BASE_URL}/table/v1/driving/${coordinates}?${params}`,
      { signal }
    )
    if (!response.ok) throw new Error('Road-route lookup is temporarily unavailable.')

    const data = await response.json()
    if (data.code !== 'Ok' || !Array.isArray(data.distances?.[0])) {
      throw new Error('The road-routing service returned no distances.')
    }

    batch.forEach((destination, index) => {
      const distanceMeters = data.distances[0][index]
      if (typeof distanceMeters !== 'number') return
      distancesById.set(destination.id, distanceMeters / 1000)
    })
  }

  return distancesById
}
