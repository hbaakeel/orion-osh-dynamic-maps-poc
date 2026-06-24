import React, { useEffect, useState, useCallback } from 'react';
import SolarWindsTopologyMap from './SolarWindsTopologyMap';

export default function App() {
  const [nodesData, setNodesData] = useState({ results: [] });
  const [edgesData, setEdgesData] = useState({ results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSolarWindsData = useCallback(async () => {
    // API calls go through the IIS reverse proxy.
    // Credentials are injected server-side via the URL Rewrite rule
    // in web.config (HTTP_Authorization server variable).
    // No passwords in client-side code.
    const apiUrl = "/topology/api/solarwinds/Query";

    try {
      setLoading(true);
      setError('');

      const [nodesResponse, linksResponse] = await Promise.all([
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              SELECT
                NodeID,
                Caption AS NodeName,
                IPAddress,
                Vendor,
                MachineType,
                Status
              FROM Orion.Nodes
              WHERE UnManaged = False
            `
          })
        }),
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              SELECT
                SrcNodeID,
                DestNodeID,
                SrcInterfaceID,
                DestInterfaceID,
                LayerType,
                SrcType,
                DestType
              FROM Orion.TopologyConnections
              WHERE SrcNodeID IS NOT NULL
                AND DestNodeID IS NOT NULL
            `
          })
        })
      ]);

      if (!nodesResponse.ok) {
        const text = await nodesResponse.text();
        throw new Error(`Nodes query failed: HTTP ${nodesResponse.status} - ${text}`);
      }

      if (!linksResponse.ok) {
        const text = await linksResponse.text();
        throw new Error(`Connections query failed: HTTP ${linksResponse.status} - ${text}`);
      }

      const nodesJson = await nodesResponse.json();
      const linksJson = await linksResponse.json();

      // Deduplicate links: keep one entry per unique src-dst-layer combo
      const validNodeIds = new Set(
        (nodesJson.results || []).map((n) => String(n.NodeID))
      );

      const deduped = [];
      const seen = new Set();

      for (const link of linksJson.results || []) {
        const src = String(link.SrcNodeID);
        const dst = String(link.DestNodeID);
        const layer = link.LayerType || 'L2';

        if (!validNodeIds.has(src) || !validNodeIds.has(dst)) {
          continue;
        }

        const key =
          src < dst
            ? `${src}-${dst}-${layer}`
            : `${dst}-${src}-${layer}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        deduped.push(link);
      }

      setNodesData(nodesJson);
      setEdgesData({ results: deduped });
    } catch (err) {
      console.error('Failed to fetch SolarWinds data:', err);
      setError(err.message || 'Failed to fetch SolarWinds data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolarWindsData();
  }, [fetchSolarWindsData]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-gray-50 text-gray-600 flex items-center justify-center">
        Loading SolarWinds topology...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full bg-gray-50 text-red-500 flex flex-col items-center justify-center gap-4 p-6">
        <div>Error loading SolarWinds topology: {error}</div>
        <button
          onClick={fetchSolarWindsData}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <SolarWindsTopologyMap
      nodesData={nodesData}
      edgesData={edgesData}
    />
  );
}
