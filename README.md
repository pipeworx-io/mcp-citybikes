# mcp-citybikes

Citybikes MCP — wraps CityBik.es API (free, no auth required)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

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

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/citybikes/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Citybikes data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
