# SolarWinds Dynamic Topology Map

An interactive, force-directed network topology visualization that runs as a SolarWinds Orion add-on. Built with React and `react-force-graph-2d`, it queries live data from the SWIS API and renders nodes with vendor-coded icons, real-time status indicators, and deep links back into Orion Node Details.

## Features

- **Automatic topology rendering** from Orion.Nodes and Orion.TopologyConnections
- **Vendor-coded icons** for routers, switches, firewalls, access points, and servers
- **Real-time status dots** — green (Up), amber (Warning), red (Critical), gray (Unknown)
- **Search and filter** by name, IP address, or vendor
- **Node detail panel** with IP, vendor, machine type, and Orion deep-link
- **Secure deployment** — API credentials injected server-side via IIS, never exposed in the browser

## Prerequisites

- Windows Server with SolarWinds Orion and IIS
- Node.js v16+ and npm
- IIS modules: [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite) and [Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)

## Quick Start

```bash
# Clone and install
git clone https://github.com/YOUR-USERNAME/solarwinds-topology-map.git
cd solarwinds-topology-map
npm install

# Development
npm start

# Production build
npm run build
```

## Deployment

1. Copy `build/` contents to a `/topology/` virtual directory on the SolarWinds IIS site
2. Convert to Application in IIS Manager
3. Enable ARR proxy (Server → ARR Cache → Enable proxy)
4. Register `HTTP_Authorization` server variable (Server → URL Rewrite → View Server Variables)
5. Add the rewrite rule from `web.config.sample` to the **root site's** `web.config`
6. Run `iisreset`

See `web.config.sample` for the IIS rewrite rule template.

## File Structure

```
src/
├── App.js                      # API calls via IIS proxy (no credentials)
├── SolarWindsTopologyMap.js    # Main topology component
├── index.js                    # React entry point
└── index.css                   # Tailwind CSS imports

web.config.sample               # IIS rewrite rule template
```

## License

MIT
