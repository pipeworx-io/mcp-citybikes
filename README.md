# @pipeworx/mcp-citybikes

MCP server for [CityBik.es](https://citybik.es) — list bike-sharing networks worldwide, get live station availability, and search by city or country. Free, no auth required.

## Tools

| Tool | Description |
|------|-------------|
| `list_networks` | List all bike-sharing networks worldwide |
| `get_network` | Get live station data for a specific network |
| `search_networks` | Search networks by city or country name |

## Quick Start

Add to your MCP client config:

```json
{
  "mcpServers": {
    "citybikes": {
      "type": "url",
      "url": "https://gateway.pipeworx.io/citybikes"
    }
  }
}
```

## CLI Usage

```bash
npx @anthropic-ai/mcp-client https://gateway.pipeworx.io/citybikes
```

## License

MIT
