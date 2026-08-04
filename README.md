# mcp-citybikes

Citybikes MCP — wraps CityBik.es API (free, no auth required)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `list_networks` | Browse all bike-sharing networks worldwide. Returns network name, ID, city, country, and coordinates for each network. |
| `get_network` | Check live bike availability at stations in a specific network (e.g., "citi-bike-nyc"). Returns station locations, available bikes, and empty slots. |
| `search_networks` | Find bike-sharing networks by city or country name. Returns matching networks with their locations and IDs. |
| `citybikes_networks_near` | Find bike-share networks near a lat/lon: "bike share near me", "find bike rental network by location", "citybikes nearby coordinates". Returns the closest networks sorted by distance with their id, name, city, country, and distance_km. If none fall within radius_km, returns count:0 plus a note naming the single nearest network beyond the radius. To then get live stations and free bikes for a returned network, call get_network with its id. Example: Göttingen (latitude 51.53, longitude 9.93) → nextbike-kassel ~39.5km away. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "citybikes": {
      "url": "https://gateway.pipeworx.io/citybikes/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Citybikes data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
