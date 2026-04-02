/**
 * Citybikes MCP — wraps CityBik.es API (free, no auth required)
 *
 * Tools:
 * - list_networks: List all bike-sharing networks worldwide
 * - get_network: Get stations and availability for a specific network
 * - search_networks: Search networks by city or country name
 */

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
}

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
      'List all bike-sharing networks worldwide. Returns name, id, and location (city, country, lat/lng) for each network.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_network',
    description:
      'Get live station data for a bike-sharing network by its id (e.g. "citi-bike-nyc"). Returns network name and all stations with bike availability, empty slots, and coordinates.',
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
      'Search bike-sharing networks by city or country name. Returns matching networks with location info.',
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
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_networks':
      return listNetworks();
    case 'get_network':
      return getNetwork(args.id as string);
    case 'search_networks':
      return searchNetworks(args.query as string);
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

export default { tools, callTool } satisfies McpToolExport;
