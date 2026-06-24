# Building an Interactive Dynamic Topology Map Add-On for SolarWinds Orion

A network topology map is only as useful as its ability to show you what matters, when it matters. The built-in SolarWinds Orion Network Atlas is great for static maps, but what if you want a dynamic, force-directed view that automatically renders your entire topology from live SWIS data — with vendor-coded icons, real-time status indicators, and deep links back into Orion Node Details?

In this post, I'll walk you through building and deploying a custom interactive topology visualization as a SolarWinds Orion add-on. The application is built with React and the Force Graph library, queries live data from the SWIS API, and runs entirely inside your existing Orion web console — no external servers required.

By the end, you'll have a fully functional topology map that:

- **Renders nodes and connections automatically** from Orion.Nodes and Orion.TopologyConnections
- **Color-codes devices by vendor** with distinct icons for routers, switches, firewalls, access points, and servers
- **Shows real-time status** with color-coded indicators (Up, Warning, Critical, Unknown)
- **Deep links into Orion** so clicking a node opens its Node Details page
- **Runs securely** with API credentials injected server-side through IIS — nothing exposed in the browser


## Architecture overview

The solution has four layers:

1. **React frontend** — a single-page application using `react-force-graph-2d` for canvas-based rendering, with Tailwind CSS for styling. The main component (`SolarWindsTopologyMap.js`) handles custom node drawing, link rendering, search, filtering, and the detail panel.

2. **IIS reverse proxy** — URL Rewrite rules with Application Request Routing (ARR) proxy the API calls from the browser to the SWIS API on port 17774. This solves CORS (different ports = different origins) and keeps credentials off the client.

3. **SWIS API** — the SolarWinds Information Service exposes Orion data via a REST/JSON endpoint. We query `Orion.Nodes` for device inventory and `Orion.TopologyConnections` for L2/L3 links.

4. **SolarWinds Orion** — the host platform. The React app lives in a `/topology/` virtual directory and is accessible from the Orion navigation bar as an external page.


## Prerequisites

Before you begin, make sure you have:

- A Windows Server running SolarWinds Orion with IIS
- Node.js v16 or later and npm installed on a development machine (this can be a separate workstation — you only need the server for deployment)
- Administrator access to IIS Manager on the Orion server
- SolarWinds admin credentials for SWIS API access
- The URL Rewrite and Application Request Routing (ARR) IIS modules installed (links below)


## Step 1: Create the React project

On your development machine, scaffold a new React application and install the dependencies:

```
npx create-react-app topology-map
cd topology-map
```

Install the core libraries:

```
npm install react-force-graph-2d
npm install lucide-react
```

`react-force-graph-2d` provides a canvas-based, physics-driven graph renderer. It handles zoom, pan, and force simulation out of the box. `lucide-react` gives us clean icons for the search bar and UI controls.

Install Tailwind CSS for styling:

```
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configure `tailwind.config.js`:

```js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

And add the Tailwind directives to `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```


## Step 2: Set the homepage path

This step is easy to overlook but critical for deployment. Open `package.json` and add:

```json
"homepage": "/topology/"
```

When React builds for production, it uses this value to prefix all static asset paths. Without it, `index.html` will reference `/static/js/main.abc123.js` instead of `/topology/static/js/main.abc123.js`. Since the app lives in a `/topology/` virtual directory on IIS, the browser will request the wrong path, IIS will return an HTML error page instead of the JS file, and you'll see this error in the console:

```
Refused to execute script from '...' because its MIME type ('text/html')
is not executable, and strict MIME type checking is enabled.
```

Setting `homepage` prevents this entirely.


## Step 3: Build the topology component

The heart of the application is `SolarWindsTopologyMap.js`. This is a React component that:

- Uses `ForceGraph2D` to render an interactive, physics-based canvas
- Implements a custom `drawNode` callback that renders each device as a white circle with a vendor-colored SVG icon, a status dot, and a vendor badge
- Draws links as bezier curves — dashed green for L3 connections, solid green for L2
- Provides a sidebar with search (by name, IP, or vendor), a vendor filter dropdown, and a detail panel that shows node properties when you click a device
- Includes an "Open in Orion Node Details" button that deep-links back into the SolarWinds web console

The component receives its data from `App.js`, which handles the SWIS API calls.


### How App.js queries the SWIS API

The application makes two POST requests to the SWIS API through the IIS proxy:

**Node query** — retrieves device inventory:

```js
fetch("/topology/api/solarwinds/Query", {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `SELECT NodeID, Caption, IPAddress, Vendor,
            MachineType, Status, ObjectSubType
            FROM Orion.Nodes`
  })
})
```

**Topology query** — retrieves L2/L3 connections:

```js
fetch("/topology/api/solarwinds/Query", {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `SELECT LocalNodeID, RemoteNodeID, LocalPortName,
            RemotePortName, DataSource
            FROM Orion.TopologyConnections`
  })
})
```

Notice there is no `Authorization` header in these calls. The credentials are injected server-side by IIS (we'll configure that in Step 6). This means nothing sensitive is exposed in the browser — if a user opens DevTools and inspects the network requests, they'll see the API calls but no passwords.


## Step 4: Build for production

Run the production build:

```
npm run build
```

This generates a `build/` folder containing the optimized, minified application:

```
build/
├── index.html
├── static/
│   ├── js/main.[hash].js
│   └── css/main.[hash].css
├── favicon.ico
└── manifest.json
```

Before moving on, open `build/index.html` and verify that the script and CSS tags reference `/topology/static/...` — not just `/static/...`. If the paths are wrong, go back and check the `homepage` field in `package.json`.


## Step 5: Deploy to IIS

On the SolarWinds server, create a virtual directory to host the React app:

1. Open **IIS Manager**
2. Find the SolarWinds website (typically "SolarWinds NetPerfMon" or the default site)
3. Right-click the site and select **Add Virtual Directory**
   - Alias: `topology`
   - Physical path: a folder like `C:\inetpub\SolarWinds\topology`
4. Right-click the new `/topology/` entry and select **Convert to Application** (use the existing SolarWinds app pool or DefaultAppPool)
5. Copy the contents of the React `build/` folder into the physical path — `index.html` and the `static/` folder should be at the root

Test by navigating to `https://your-server/topology/index.html`. You should see the React app shell load (the topology won't render yet because the API proxy isn't configured).


## Step 6: Configure the IIS reverse proxy

The SWIS API runs on port 17774 over HTTPS. Since the React app is served from port 443, the browser treats these as different origins and blocks the API calls with a CORS error:

```
Access to fetch at 'https://server:17774/...' from origin 'https://server'
has been blocked by CORS policy
```

The solution is to proxy the API calls through IIS using URL Rewrite and Application Request Routing (ARR). The browser sends requests to `/api/solarwinds/Query` on the same origin, and IIS rewrites them to the SWIS API on port 17774 behind the scenes.

### Install the IIS modules

Download and install:

- **URL Rewrite**: https://www.iis.net/downloads/microsoft/url-rewrite
- **Application Request Routing (ARR)**: https://www.iis.net/downloads/microsoft/application-request-routing

### Enable the ARR proxy

1. In IIS Manager, click the **server name** (the top-level node)
2. Double-click **Application Request Routing Cache**
3. Click **Server Proxy Settings** in the right-hand panel
4. Check **Enable proxy** and click Apply

### Register the Authorization server variable

This step must be done at the server level — not the site level. If you skip it or put it in the wrong place, you'll get a 500 Internal Server Error.

1. In IIS Manager, click the **server name** (top-level node)
2. Double-click **URL Rewrite**
3. Click **View Server Variables** in the right panel
4. Click **Add**, enter `HTTP_Authorization`, and click OK

### Generate the Base64 credentials

The SWIS API uses HTTP Basic authentication. Encode your credentials in `username:password` format:

In a browser console (F12 → Console):

```js
btoa("admin:YourPasswordHere")
```

Or in PowerShell:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("admin:YourPasswordHere"))
```

Copy the output string.

### Add the rewrite rule

Open the **root site's** `web.config` (e.g. `C:\inetpub\SolarWinds\web.config`) and add the following inside the `<system.webServer>` section:

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

Replace `your-server` with the actual hostname and `YOUR_BASE64_STRING` with the encoded credentials from above.

**Important**: This rule must be in the **root site's** `web.config`, not the one inside the `/topology/` subfolder. The URL pattern `^api/solarwinds/(.*)` matches at the site root — if the rule is inside `/topology/`, it will never fire because the request path doesn't start with `api/solarwinds/` relative to that folder.

### Restart IIS

From an administrator command prompt:

```
iisreset
```


## Step 7: Verify the proxy

Test the proxy independently by navigating to:

```
https://your-server/api/solarwinds/Query
```

You should see an API error response (something like "Missing query parameter" or an XML error). What matters is that you're getting a response from the SWIS API — not an HTML page from SolarWinds Orion. If you see "No HTTP resource was found that matches the request URI," the rewrite rule isn't matching.


## Step 8: Test the application

Navigate to:

```
https://your-server/topology/index.html
```

The topology map should load with live data. Verify:

- Nodes render with correct vendor icons (routers, switches, firewalls, etc.)
- Status dots show green (Up), amber (Warning), red (Critical), or gray (Unknown)
- The sidebar search filters by name, IP, or vendor
- Clicking a node opens the detail panel with IP address, vendor, machine type, and Node ID
- The "Open in Orion Node Details" button navigates to the correct SolarWinds page
- In DevTools (F12 → Network), API calls return 200 OK and no Authorization header appears in the browser-side request headers


## Step 9: Add to Orion navigation

The final step is making the topology map accessible from the SolarWinds web console:

1. Log into SolarWinds Orion as an administrator
2. Navigate to **Settings → All Settings → Manage External Websites**
3. Add a new external page with URL `/topology/index.html` and a display name like "Dynamic Map"
4. Go to **Settings → Customize Menu Bar** and add the "Dynamic Map" entry to the main navigation or a submenu

Users will now see "Dynamic Map" in the Orion menu bar. Clicking it loads the topology visualization inside the Orion frame.


## Troubleshooting

Here are the issues I ran into during deployment and how I resolved them:

**MIME type error on JS files** — The browser refuses to execute the JavaScript because IIS is serving it as `text/html`. This happens when the asset path is wrong and IIS returns an HTML error page instead of the JS file. Fix: set `"homepage": "/topology/"` in `package.json` and rebuild.

**CORS blocked** — The browser blocks API calls to port 17774 because it's a different origin. Fix: use the IIS reverse proxy so all requests stay on the same origin (port 443).

**500 Internal Server Error** — The `allowedServerVariables` directive or server variable registration is in the wrong place. Server variables like `HTTP_Authorization` must be registered at the IIS **server level** (URL Rewrite → View Server Variables), not in a site-level `web.config`.

**400 Bad Request** — The request reaches the SWIS API but the POST body or headers are wrong. Check that ARR proxy is enabled (Server → ARR Cache → Enable proxy) and that the rewrite rule is in the **root site's** `web.config`, not the `/topology/` subfolder's `web.config`.

**Credentials visible in DevTools** — You have hardcoded credentials in `App.js`. Remove all `username`, `password`, `btoa()`, and `Authorization` header lines from the client code. The IIS rewrite rule injects the credentials server-side.

**"No HTTP resource was found"** — The rewrite rule exists but isn't matching. Confirm it's in the root `web.config` and run `iisreset`.

**General tip**: Run `iisreset` from an admin command prompt after every `web.config` or ARR configuration change. IIS doesn't always pick up changes immediately.


## What's next

This topology map is a starting point. Some directions you could take it:

- **AI integration** — add an AI-powered "Explain This Issue" button that walks the topology graph, reads metrics, and generates an Incident Response payload for Squadcast or PagerDuty
- **Real-time polling** — add a refresh interval to re-query the SWIS API every 30-60 seconds for live status updates
- **Custom grouping** — render nodes in subnet-based clusters or site-based groups instead of pure force-directed layout
- **Additional data sources** — overlay interface utilization, response time, or alert counts from other SWIS entities

The code for this project is available for reference in https://github.com/hbaakeel/orion-osh-dynamic-maps-poc . If you have questions or want to share your own customizations, drop a comment below.


Disclaimer


This project is a proof-of-concept and is not intended as a production-ready application. The device icons use simplified SVG representations created during development, and some devices will fall back to a generic default icon. The icon mappings, node type classification logic, and vendor detection rules will need to be adapted and expanded to reflect the devices, vendors, and naming conventions in your own environment. Treat this as a starting point to build on, not a finished product.


