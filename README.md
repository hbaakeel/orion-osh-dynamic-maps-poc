# Building an Interactive Dynamic Topology Map Add-On for SolarWinds Orion

A network topology map is only as useful as its ability to show you what matters, when it matters. The built-in Network Atlas is great for static maps, but what if you want a dynamic, force-directed view that automatically renders your entire topology from live SWIS data — with vendor-coded icons, real-time status indicators, and deep links back into Orion Node Details?

In this post, I'll walk through building and deploying a custom interactive topology visualization as a SolarWinds Orion add-on. It's built with React and the Force Graph library, queries live data from the SWIS API, and runs entirely inside your existing Orion web console.

**The complete source code is available on GitHub: https://github.com/hbaakeel/orion-osh-dynamic-maps-poc/ **

By the end, you'll have a topology map that:

- **Renders nodes and connections automatically** from Orion.Nodes and Orion.TopologyConnections
- **Color-codes devices by vendor** with distinct icons for routers, switches, firewalls, APs, and servers
- **Shows real-time status** with color-coded indicators (Up, Warning, Critical, Unknown)
- **Deep links into Orion** so clicking a node opens its Node Details page
- **Runs securely** with API credentials injected server-side through IIS


## Architecture

The solution has four layers:

1. **React frontend** — `react-force-graph-2d` for canvas rendering, Tailwind CSS for styling
2. **IIS reverse proxy** — URL Rewrite + ARR proxy API calls to SWIS on port 17774, solving CORS and keeping credentials off the client
3. **SWIS API** — queries `Orion.Nodes` for devices and `Orion.TopologyConnections` for L2/L3 links
4. **SolarWinds Orion** — host platform, React app lives in a `/topology/` virtual directory


## Step 1: Create the React Project

```
npx create-react-app topology-map
cd topology-map
npm install react-force-graph-2d lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Critical**: Add `"homepage": "/topology/"` to `package.json`. Without it, static assets load from the wrong path and you'll get MIME type errors on IIS.


## Step 2: The API Layer (App.js)

`App.js` fetches data through the IIS proxy — no hardcoded credentials:

```js
const apiUrl = "/topology/api/solarwinds/Query";

const [nodesResponse, linksResponse] = await Promise.all([
  fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `SELECT NodeID, Caption AS NodeName, IPAddress,
              Vendor, MachineType, Status
              FROM Orion.Nodes WHERE UnManaged = False`
    })
  }),
  fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `SELECT SrcNodeID, DestNodeID, LayerType
              FROM Orion.TopologyConnections
              WHERE SrcNodeID IS NOT NULL
                AND DestNodeID IS NOT NULL`
    })
  })
]);
```

No `Authorization` header — IIS injects it server-side. Links are deduplicated so each connection appears only once.


## Step 3: The Topology Component (SolarWindsTopologyMap.js)

This ~630-line component handles all the rendering. The key pieces:

**Node type detection** — maps SolarWinds MachineType strings to visual categories:

```js
const classifyNodeType = (machineType = '', vendor = '') => {
  const mt = machineType.toLowerCase();
  if (mt.match(/router|catalyst|isr|asr/)) return 'router';
  if (mt.match(/switch|nexus|sg[0-9]/)) return 'switch';
  if (mt.match(/firewall|fortigate|palo|asa/)) return 'firewall';
  if (mt.match(/wireless|wap|access.?point|ap[0-9]/)) return 'wifi';
  if (mt.match(/server|vm|host|esxi|hyperv/)) return 'server';
  if (mt.match(/database|sql|oracle/)) return 'database';
  return 'default';
};
```

**Custom SVG icons** — rendered to canvas images with vendor-colored accents:

```js
const buildIconSet = (stroke, accent) => ({
  router: makeIconImage(`<svg ...><circle fill="white"/>
    <path d="M16 28h32v8H16z" stroke="${stroke}"/>...</svg>`),
  switch: makeIconImage(`<svg ...>...</svg>`),
  firewall: makeIconImage(`<svg ...>...</svg>`),
  // ... wifi, server, database, default
});
```

**Custom node drawing** — white circles with vendor icons, status dots, and labels:

```js
const drawNode = (node, ctx, globalScale) => {
  // White circle with shadow
  ctx.arc(node.x, node.y, 16, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Draw device icon, vendor badge, status dot
  // Show label at higher zoom levels
};
```

**Link rendering** — bezier curves, dashed green for L3, solid for L2.

The full source with all icon definitions, vendor badge rendering, tooltip, sidebar, and detail panel is in the GitHub repo.


## Step 4: Build and Deploy to IIS

```
npm run build
```

On the SolarWinds server:

1. **IIS Manager** → right-click the SolarWinds site → **Add Virtual Directory** (Alias: `topology`)
2. Right-click `/topology/` → **Convert to Application**
3. Copy `build/` contents into the physical path
4. Test at `https://your-server/topology/index.html`


## Step 5: Configure the Reverse Proxy

### Install IIS Modules

- **URL Rewrite**: https://www.iis.net/downloads/microsoft/url-rewrite
- **Application Request Routing**: https://www.iis.net/downloads/microsoft/application-request-routing

### Enable ARR Proxy

IIS Manager → server name → **Application Request Routing Cache** → **Server Proxy Settings** → check **Enable proxy** → Apply

### Register the Server Variable

IIS Manager → server name → **URL Rewrite** → **View Server Variables** → Add → `HTTP_Authorization`

This **must** be at the server level. Putting it in a site-level `web.config` causes a 500 error.

### Generate Base64 Credentials

```js
// Browser console
btoa("admin:YourPasswordHere")
```

### Add the Rewrite Rule

Add to the **root site's** `web.config` (not the `/topology/` subfolder):

```xml
<rewrite>
  <rules>
    <rule name="SolarWinds API Proxy" stopProcessing="true">
      <match url="^api/solarwinds/(.*)" />
      <action type="Rewrite"
        url="https://your-server:17774/SolarWinds/InformationService/v3/Json/{R:1}" />
      <serverVariables>
        <set name="HTTP_Authorization" value="Basic YOUR_BASE64_STRING" />
      </serverVariables>
    </rule>
  </rules>
</rewrite>
```

Run `iisreset` after saving.


## Step 6: Verify and Add to Orion

1. Test proxy: `https://your-server/api/solarwinds/Query` should return an API error (not HTML)
2. Test app: `https://your-server/topology/index.html` should render the topology
3. Verify in DevTools: API calls return 200, no Authorization header in browser requests
4. **Settings → Manage External Websites** → add `/topology/index.html` as "Dynamic Map"
5. **Settings → Customize Menu Bar** → add to navigation


## Troubleshooting

- **MIME type error on JS files** — `"homepage": "/topology/"` missing from `package.json`
- **CORS blocked** — use the IIS proxy, don't call port 17774 directly
- **500 error** — register `HTTP_Authorization` at IIS server level, not site level
- **400 Bad Request** — enable ARR proxy; put rewrite rule in **root** `web.config`
- **Credentials in DevTools** — remove from `App.js`, let IIS inject them
- **"No HTTP resource"** — rewrite rule not in root `web.config`; run `iisreset`


## What's Next

- **GOAT integration** — AI-powered "Explain This Issue" that walks the topology graph and generates Incident Response payloads
- **Real-time polling** — re-query SWIS every 30-60 seconds
- **Custom grouping** — subnet or site-based clusters
- **Additional data** — overlay interface utilization, response time, or alerts


## Disclaimer

This project is a proof-of-concept and is not intended as a production-ready application. The device icons use simplified SVG representations created during development, and some devices will fall back to a generic default icon. The icon mappings, node type classification logic, and vendor detection rules will need to be adapted and expanded to reflect the devices, vendors, and naming conventions in your own environment. Treat this as a starting point to build on, not a finished product.

**Full source code: https://github.com/hbaakeel/orion-osh-dynamic-maps-poc/ **
