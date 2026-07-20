interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Citybikes MCP — wraps CityBik.es API (free, no auth required)
 *
 * Tools:
 * - list_networks: List all bike-sharing networks worldwide
 * - get_network: Get stations and availability for a specific network
 * - search_networks: Search networks by city or country name
 */


const BASE_URL = 'https://api.citybik.es/v2';

interface NetworkLocation {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface NetworkSummary {
  id: string;
  name: string;
  location: NetworkLocation;
  href: string;
}

interface NetworksResponse {
  networks: NetworkSummary[];
}

interface Station {
  id: string;
  name: string;
  free_bikes: number;
  empty_slots: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  extra?: Record<string, unknown>;
}

interface NetworkDetail {
  id: string;
  name: string;
  location: NetworkLocation;
  stations: Station[];
}

interface NetworkDetailResponse {
  network: NetworkDetail;
}

// In-isolate cache of the full network list (6h TTL). CityBik.es publishes
// ~800 networks (~110KB); caching avoids re-fetching for proximity lookups.
const NETWORK_LIST_TTL_MS = 6 * 60 * 60 * 1000;
let networkListCache: { networks: NetworkSummary[]; fetchedAt: number } | null = null;

async function getNetworkList(): Promise<NetworkSummary[]> {
  if (networkListCache && Date.now() - networkListCache.fetchedAt < NETWORK_LIST_TTL_MS) {
    return networkListCache.networks;
  }
  const res = await fetch(`${BASE_URL}/networks?fields=id,name,location`);
  if (!res.ok) throw new Error(`CityBik.es error: ${res.status}`);
  const data = (await res.json()) as NetworksResponse;
  networkListCache = { networks: data.networks, fetchedAt: Date.now() };
  return data.networks;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shapeNetworkSummary(n: NetworkSummary) {
  return {
    id: n.id,
    name: n.name,
    city: n.location.city,
    country: n.location.country,
    latitude: n.location.latitude,
    longitude: n.location.longitude,
  };
}

function shapeStation(s: Station) {
  return {
    id: s.id,
    name: s.name,
    free_bikes: s.free_bikes,
    empty_slots: s.empty_slots,
    latitude: s.latitude,
    longitude: s.longitude,
    timestamp: s.timestamp,
  };
}

const tools: McpToolExport['tools'] = [
  {
    name: 'list_networks',
    description:
      'Browse all bike-sharing networks worldwide. Returns network name, ID, city, country, and coordinates for each network.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_network',
    description:
      'Check live bike availability at stations in a specific network (e.g., "citi-bike-nyc"). Returns station locations, available bikes, and empty slots.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Network id (e.g. "citi-bike-nyc", "velib" for Paris, "nextbike-berlin")',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_networks',
    description:
      'Find bike-sharing networks by city or country name. Returns matching networks with their locations and IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'City or country name to search for (e.g. "New York", "France", "Berlin")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'citybikes_networks_near',
    description:
      'Find bike-share networks near a lat/lon: "bike share near me", "find bike rental network by location", "citybikes nearby coordinates". Returns the closest networks sorted by distance with their id, name, city, country, and distance_km. If none fall within radius_km, returns count:0 plus a note naming the single nearest network beyond the radius. To then get live stations and free bikes for a returned network, call get_network with its id. Example: Göttingen (latitude 51.53, longitude 9.93) → nextbike-kassel ~39.5km away.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude of the search center (e.g. 51.53)' },
        longitude: { type: 'number', description: 'Longitude of the search center (e.g. 9.93)' },
        radius_km: {
          type: 'number',
          description:
            'Search radius in kilometers (default 50; bike networks are sparse, so the nearest city may be 30km+ away)',
        },
        limit: {
          type: 'number',
          description: 'Max networks to return, 1-20 (default 5)',
        },
      },
      required: ['latitude', 'longitude'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_networks':
      return listNetworks();
    case 'get_network':
      return getNetwork(args.id as string);
    case 'search_networks':
      return searchNetworks(args.query as string);
    case 'citybikes_networks_near':
      return networksNear(
        args.latitude as number,
        args.longitude as number,
        args.radius_km as number | undefined,
        args.limit as number | undefined,
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function listNetworks() {
  const res = await fetch(`${BASE_URL}/networks`);
  if (!res.ok) throw new Error(`CityBik.es error: ${res.status}`);

  const data = (await res.json()) as NetworksResponse;
  const networks = data.networks.map(shapeNetworkSummary);
  return { count: networks.length, networks };
}

async function getNetwork(id: string) {
  const res = await fetch(`${BASE_URL}/networks/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error(`Network not found: ${id}`);
  if (!res.ok) throw new Error(`CityBik.es error: ${res.status}`);

  const data = (await res.json()) as NetworkDetailResponse;
  const network = data.network;
  return {
    id: network.id,
    name: network.name,
    city: network.location.city,
    country: network.location.country,
    station_count: network.stations.length,
    stations: network.stations.map(shapeStation),
  };
}

async function searchNetworks(query: string) {
  const res = await fetch(`${BASE_URL}/networks`);
  if (!res.ok) throw new Error(`CityBik.es error: ${res.status}`);

  const data = (await res.json()) as NetworksResponse;
  const q = query.toLowerCase();
  const matches = data.networks
    .filter(
      (n) =>
        n.location.city.toLowerCase().includes(q) ||
        n.location.country.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q),
    )
    .map(shapeNetworkSummary);

  return { count: matches.length, networks: matches };
}

async function networksNear(
  latitude: number,
  longitude: number,
  radiusKm?: number,
  limit?: number,
) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('latitude and longitude are required numbers');
  }
  const radius = typeof radiusKm === 'number' && radiusKm > 0 ? radiusKm : 50;
  const max = Math.min(Math.max(typeof limit === 'number' ? Math.floor(limit) : 5, 1), 20);

  const networks = await getNetworkList();
  const ranked = networks
    .map((n) => ({
      network: n,
      distance_km: haversineKm(latitude, longitude, n.location.latitude, n.location.longitude),
    }))
    .sort((a, b) => a.distance_km - b.distance_km);

  const within = ranked.filter((r) => r.distance_km <= radius).slice(0, max);

  const center = { latitude, longitude };

  if (within.length === 0) {
    const nearest = ranked[0];
    const note = nearest
      ? `No bike-share network within ${radius}km. Nearest is ${nearest.network.id} (${nearest.network.location.city}, ${nearest.network.location.country}), ${nearest.distance_km.toFixed(1)}km away — call get_network with that id for live stations.`
      : 'No bike-share networks available.';
    return { center, radius_km: radius, count: 0, networks: [], note };
  }

  return {
    center,
    radius_km: radius,
    count: within.length,
    networks: within.map((r) => ({
      id: r.network.id,
      name: r.network.name,
      city: r.network.location.city,
      country: r.network.location.country,
      distance_km: Number(r.distance_km.toFixed(1)),
      latitude: r.network.location.latitude,
      longitude: r.network.location.longitude,
    })),
  };
}

export default { tools, callTool, meter: { credits: 2 } } satisfies McpToolExport;
