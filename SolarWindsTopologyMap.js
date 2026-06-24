import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Search, X } from 'lucide-react';

const getStatusColor = (status) => {
  switch (status) {
    case 1: return '#10b981';
    case 2: return '#f59e0b';
    case 3: return '#ef4444';
    case 14: return '#9ca3af';
    default: return '#9ca3af';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 1: return 'Up';
    case 2: return 'Warning';
    case 3: return 'Critical';
    case 14: return 'Unknown';
    default: return `Status ${status}`;
  }
};

const getNodeType = (vendor, machineType, nodeName = '') => {
  const v = (vendor || '').toLowerCase();
  const m = (machineType || '').toLowerCase();
  const n = (nodeName || '').toLowerCase();

  if (
    m.includes('firewall') ||
    v.includes('fortinet') ||
    v.includes('palo alto') ||
    n.includes('fw-') ||
    n.includes('srx') ||
    n.includes('vpn')
  ) return 'firewall';

  if (
    m.includes('wireless') ||
    m.includes('wlc') ||
    m.includes('meraki mr') ||
    v.includes('ruckus') ||
    n.includes('wap') ||
    n.endsWith('ap')
  ) return 'wifi';

  if (
    m.includes('switch') ||
    m.includes('nexus') ||
    m.includes('ms220') ||
    m.includes('silkworm') ||
    m.includes('procurve') ||
    n.includes('-sw') ||
    n.includes('switch')
  ) return 'switch';

  if (
    m.includes('router') ||
    m.includes('cisco 28') ||
    m.includes('cisco 29') ||
    m.includes('asr') ||
    n.includes('rtr') ||
    n.includes('mpls') ||
    n.includes('bgp')
  ) return 'router';

  if (
    m.includes('windows') ||
    m.includes('vmware') ||
    v.includes('lenovo') ||
    n.includes('server') ||
    n.includes('esx')
  ) return 'server';

  if (
    n.includes('db') ||
    n.includes('storage') ||
    m.includes('storage')
  ) return 'database';

  return 'default';
};

const getVendorAccent = (vendor = '') => {
  const v = vendor.toLowerCase();
  if (v.includes('cisco')) return '#3b82f6';
  if (v.includes('meraki')) return '#10b981';
  if (v.includes('fortinet')) return '#f59e0b';
  if (v.includes('palo alto')) return '#f97316';
  if (v.includes('vmware')) return '#8b5cf6';
  if (v.includes('ruckus')) return '#22c55e';
  if (v.includes('juniper')) return '#0ea5e9';
  if (v.includes('mikrotik')) return '#6b7280';
  if (v.includes('f5')) return '#ef4444';
  if (v.includes('brocade')) return '#eab308';
  return '#6b7280';
};

const getVendorType = (vendor = '') => {
  const v = vendor.toLowerCase();
  if (v.includes('cisco')) return 'cisco';
  if (v.includes('meraki')) return 'meraki';
  if (v.includes('fortinet')) return 'fortinet';
  if (v.includes('palo alto')) return 'paloalto';
  if (v.includes('vmware')) return 'vmware';
  if (v.includes('ruckus')) return 'ruckus';
  if (v.includes('juniper')) return 'juniper';
  if (v.includes('mikrotik')) return 'mikrotik';
  if (v.includes('f5')) return 'f5';
  if (v.includes('brocade')) return 'brocade';
  return 'default';
};

const svgToDataUrl = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const makeIconImage = (svg) => {
  const img = new Image();
  img.src = svgToDataUrl(svg);
  return img;
};

const buildIconSet = (stroke, accent) => ({
  router: makeIconImage(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="white"/>
      <path d="M16 28h32v8H16z" stroke="${stroke}" stroke-width="3" rx="3"/>
      <path d="M20 24l6 4m18-4l-6 4M20 40l6-4m18 4l-6-4" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="24" cy="32" r="1.8" fill="${accent}"/>
      <circle cx="32" cy="32" r="1.8" fill="${accent}"/>
      <circle cx="40" cy="32" r="1.8" fill="${accent}"/>
    </svg>
  `),
  switch: makeIconImage(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="white"/>
      <rect x="14" y="22" width="36" height="20" rx="4" stroke="${stroke}" stroke-width="3"/>
      <path d="M21 29h4M29 29h4M37 29h4M21 35h20" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `),
  firewall: makeIconImage(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="white"/>
      <path d="M18 46V18h10v7h8v-7h10v28z" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M28 36c0-5 4-8 4-8s4 3 4 8c0 5-4 8-4 8s-4-3-4-8z" stroke="${accent}" stroke-width="3"/>
    </svg>
  `),
  wifi: makeIconImage(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="white"/>
      <path d="M16 28c9-9 23-9 32 0" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
      <path d="M22 34c6-6 14-6 20 0" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
      <path d="M28 40c3-3 5-3 8 0" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="47" r="2.8" fill="${accent}"/>
    </svg>
  `),
  server: makeIconImage(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="white"/>
      <rect x="18" y="16" width="28" height="14" rx="3" stroke="${stroke}" stroke-width="3"/>
      <rect x="18" y="34" width="28" height="14" rx="3" stroke="${stroke}" stroke-width="3"/>
    </svg>
  `),
  database: makeIconImage(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="white"/>
      <ellipse cx="32" cy="20" rx="14" ry="6" stroke="${stroke}" stroke-width="3"/>
      <path d="M18 20v20c0 3.3 6.3 6 14 6s14-2.7 14-6V20" stroke="${stroke}" stroke-width="3"/>
    </svg>
  `),
  default: makeIconImage(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="white"/>
      <circle cx="32" cy="32" r="10" stroke="${stroke}" stroke-width="3"/>
    </svg>
  `)
});

const VENDOR_BADGES = {
  cisco: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#3b82f6" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="9" fill="#3b82f6" font-family="Arial" font-weight="bold">C</text></svg>`),
  meraki: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#10b981" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="8" fill="#10b981" font-family="Arial" font-weight="bold">M</text></svg>`),
  fortinet: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#f59e0b" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="7" fill="#f59e0b" font-family="Arial" font-weight="bold">FT</text></svg>`),
  paloalto: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#f97316" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="7" fill="#f97316" font-family="Arial" font-weight="bold">PA</text></svg>`),
  vmware: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#8b5cf6" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="7" fill="#8b5cf6" font-family="Arial" font-weight="bold">VM</text></svg>`),
  ruckus: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#22c55e" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="7" fill="#22c55e" font-family="Arial" font-weight="bold">RU</text></svg>`),
  juniper: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#0ea5e9" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="7" fill="#0ea5e9" font-family="Arial" font-weight="bold">J</text></svg>`),
  mikrotik: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#6b7280" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="7" fill="#6b7280" font-family="Arial" font-weight="bold">MT</text></svg>`),
  f5: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#ef4444" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="8" fill="#ef4444" font-family="Arial" font-weight="bold">F5</text></svg>`),
  brocade: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#eab308" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="7" fill="#eab308" font-family="Arial" font-weight="bold">BR</text></svg>`),
  default: makeIconImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white" stroke="#9ca3af" stroke-width="2"/><text x="16" y="20" text-anchor="middle" font-size="8" fill="#9ca3af" font-family="Arial" font-weight="bold">?</text></svg>`)
};

const iconCache = new Map();
const getIconsForVendor = (vendor) => {
  const accent = getVendorAccent(vendor);
  const key = accent;
  if (!iconCache.has(key)) {
    iconCache.set(key, buildIconSet('#94a3b8', accent));
  }
  return iconCache.get(key);
};

export default function SolarWindsTopologyMap({ nodesData, edgesData }) {
  const fgRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [selectedNode, setSelectedNode] = useState(null);

  const graphData = useMemo(() => {
    const rawNodes = nodesData?.results || [];
    const rawLinks = edgesData?.results || [];

    const parsedNodes = rawNodes.map((n) => ({
      id: String(n.NodeID),
      swNodeId: String(n.NodeID),
      label: n.NodeName || `Node ${n.NodeID}`,
      ip: n.IPAddress || '',
      vendor: n.Vendor || 'Unknown',
      machineType: n.MachineType || 'Unknown',
      status: n.Status,
      description: n.NodeDescription || '',
      color: getStatusColor(n.Status),
      nodeType: getNodeType(n.Vendor, n.MachineType, n.NodeName),
      vendorAccent: getVendorAccent(n.Vendor || 'Unknown'),
      vendorType: getVendorType(n.Vendor || 'Unknown')
    }));

    const parsedLinks = rawLinks
      .map((e, index) => ({
        id: `link-${index}`,
        source: e.SrcNodeID != null ? String(e.SrcNodeID) : null,
        target: e.DestNodeID != null ? String(e.DestNodeID) : null,
        layer: e.LayerType || 'L2'
      }))
      .filter((l) => l.source && l.target && l.source !== l.target);

    return { nodes: parsedNodes, links: parsedLinks };
  }, [nodesData, edgesData]);

  const filteredData = useMemo(() => {
    let nodes = [...graphData.nodes];
    let links = [...graphData.links];

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      nodes = nodes.filter(
        (n) =>
          (n.label || '').toLowerCase().includes(s) ||
          (n.ip || '').toLowerCase().includes(s) ||
          (n.vendor || '').toLowerCase().includes(s) ||
          (n.machineType || '').toLowerCase().includes(s)
      );
    }

    if (vendorFilter !== 'All') {
      nodes = nodes.filter((n) => n.vendor === vendorFilter);
    }

    const allowedNodeIds = new Set(nodes.map((n) => n.id));

    links = links.filter((l) => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return allowedNodeIds.has(sourceId) && allowedNodeIds.has(targetId);
    });

    const connectedIds = new Set();
    links.forEach((l) => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      connectedIds.add(sourceId);
      connectedIds.add(targetId);
    });

    nodes = nodes.filter((n) => connectedIds.has(n.id));

    return { nodes, links };
  }, [graphData, search, vendorFilter]);

  const uniqueVendors = useMemo(
    () => ['All', ...new Set(graphData.nodes.map((n) => n.vendor).filter(Boolean))],
    [graphData.nodes]
  );

  useEffect(() => {
    if (!fgRef.current || !filteredData.nodes.length) return;
    const timer = setTimeout(() => {
      try {
        fgRef.current.zoomToFit(900, 180);
      } catch {}
    }, 900);
    return () => clearTimeout(timer);
  }, [filteredData]);

  useEffect(() => {
    if (!selectedNode) return;
    if (!filteredData.nodes.some((n) => n.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [filteredData, selectedNode]);

  useEffect(() => {
    if (!fgRef.current) return;

    const chargeForce = fgRef.current.d3Force('charge');
    if (chargeForce) {
      chargeForce.strength(-120);
    }

    const linkForce = fgRef.current.d3Force('link');
    if (linkForce) {
      linkForce.distance((link) => (link.layer === 'L3' ? 100 : 80));
    }
  }, [filteredData]);

  const openOrionNodeDetails = useCallback((node) => {
    if (!node?.id) return;

    const swNodeId = node.swNodeId || node.id;
    window.open(
      `/Orion/NetPerfMon/NodeDetails.aspx?NetObject=N:${swNodeId}`,
      '_blank'
    );
  }, []);

  const drawNode = useCallback((node, ctx, globalScale) => {
    const iconSize = 20;
    const ringRadius = 16;
    const isActive = hoveredNode?.id === node.id || selectedNode?.id === node.id;
    const glowRadius = isActive ? 26 : 20;

    const icons = getIconsForVendor(node.vendor);
    const icon = icons[node.nodeType] || icons.default;
    const vendorBadge = VENDOR_BADGES[node.vendorType] || VENDOR_BADGES.default;

    ctx.save();

    /* Soft glow */
    if (isActive) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.fill();
    }

    /* White circle with border */
    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    /* Shadow */
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.strokeStyle = isActive
      ? '#10b981'
      : hoveredNode?.id === node.id
        ? '#6ee7b7'
        : '#e5e7eb';
    ctx.stroke();
    ctx.shadowColor = 'transparent';

    if (icon && icon.complete) {
      ctx.drawImage(icon, node.x - iconSize / 2, node.y - iconSize / 2, iconSize, iconSize);
    }

    if (vendorBadge && vendorBadge.complete) {
      ctx.drawImage(vendorBadge, node.x - 7, node.y + 9, 14, 14);
    }

    /* Status dot */
    ctx.beginPath();
    ctx.arc(node.x + 14, node.y - 14, 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    /* Label */
    const showLabel =
      zoomLevel >= 1.8 ||
      selectedNode?.id === node.id ||
      hoveredNode?.id === node.id;

    if (showLabel) {
      const fontSize = Math.max(7 / globalScale, 3);

      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#374151';
      ctx.fillText(node.label || '', node.x, node.y + 24);

      ctx.font = `${fontSize * 0.85}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = '#9ca3af';
      ctx.fillText((node.nodeType || '').toUpperCase(), node.x, node.y + 24 + fontSize + 2);
    }

    ctx.restore();
  }, [hoveredNode, selectedNode, zoomLevel]);

  const drawLink = useCallback((link, ctx) => {
    const source = link.source;
    const target = link.target;
    if (
      source?.x == null ||
      source?.y == null ||
      target?.x == null ||
      target?.y == null
    ) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.lineWidth = 2;

    if (link.layer === 'L3') {
      ctx.setLineDash([8, 5]);
      ctx.strokeStyle = '#86efac';
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#6ee7b7';
    }
    ctx.stroke();

    if (zoomLevel >= 2.2) {
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      ctx.setLineDash([]);
      ctx.fillStyle = link.layer === 'L3' ? '#059669' : '#6b7280';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(link.layer, mx, my);
    }

    ctx.restore();
  }, [zoomLevel]);

  const handleNodeHover = useCallback((node, event) => {
    setHoveredNode(node || null);

    if (!node || !event) {
      setTooltip(null);
      return;
    }

    setTooltip({
      x: event.clientX,
      y: event.clientY,
      node
    });
  }, []);

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-700 font-sans overflow-hidden">
      <div className="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Topology Controls</h2>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, IP, vendor..."
              className="w-full bg-gray-50 border border-gray-200 rounded pl-9 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-emerald-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">
              Filter by Vendor
            </label>
            <select
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-emerald-500"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              {uniqueVendors.map((vendor) => (
                <option key={vendor} value={vendor}>{vendor}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Showing {filteredData.nodes.length} nodes / {filteredData.links.length} links
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-lg text-gray-800 break-all">
                  {selectedNode.label}
                </h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-700 transition"
                  aria-label="Close details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color }} />
                <span className="font-semibold text-gray-600">
                  {getStatusText(selectedNode.status)} ({selectedNode.status})
                </span>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => openOrionNodeDetails(selectedNode)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2 px-3 rounded border border-emerald-500 transition"
                >
                  Open in Orion Node Details
                </button>
              </div>

              <div className="bg-gray-50 rounded p-3 space-y-3 border border-gray-200 text-sm">
                <div>
                  <span className="text-gray-400 block text-xs">Node Name</span>
                  <span className="text-gray-800 break-all">{selectedNode.label || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">IP Address</span>
                  <span className="text-gray-800">{selectedNode.ip || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Vendor</span>
                  <span className="text-gray-800">{selectedNode.vendor || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Machine Type</span>
                  <span className="text-gray-800 break-words">{selectedNode.machineType || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Node Type</span>
                  <span className="text-gray-800">{selectedNode.nodeType || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Vendor Type</span>
                  <span className="text-gray-800">{selectedNode.vendorType || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Node ID</span>
                  <span className="text-gray-800">{selectedNode.id}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm text-center">
              Click a node to view details.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative bg-gray-50">
        <ForceGraph2D
          ref={fgRef}
          graphData={filteredData}
          backgroundColor="#f9fafb"
          nodeCanvasObject={drawNode}
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={drawLink}
          onNodeClick={(node) => setSelectedNode(node)}
          onNodeHover={handleNodeHover}
          onBackgroundClick={() => {
            setHoveredNode(null);
            setTooltip(null);
          }}
          onZoom={({ k }) => setZoomLevel(k)}
          enableNodeDrag={true}
          cooldownTicks={500}
          d3AlphaDecay={0.006}
          d3VelocityDecay={0.5}
          nodeRelSize={7}
          onEngineStop={() => {
            try {
              fgRef.current?.zoomToFit(1000, 220);
            } catch {}
          }}
        />

        {tooltip ? (
          <div
            className="absolute pointer-events-none z-20 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs text-gray-600"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
          >
            <div className="font-semibold text-gray-900 text-sm">{tooltip.node.label}</div>
            <div className="text-gray-400 mt-0.5">{tooltip.node.ip || '-'}</div>
            <div className="text-gray-400">{tooltip.node.vendor}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: tooltip.node.color }}
              />
              <span className="text-gray-600">{getStatusText(tooltip.node.status)}</span>
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-6 right-6 bg-white border border-gray-200 rounded-xl p-3 text-xs shadow-sm flex gap-5 text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-5 border-t-2 border-emerald-300 border-dashed"></div>
            <span>L3 Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 border-t-2 border-emerald-400"></div>
            <span>L2 Connection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
