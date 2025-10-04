// helper: GeoJSON Polygon -> EsriJSON Polygon
function geoJSONtoEsriPolygon(geojson) {
  const g = geojson.type ? geojson : (geojson.geometry || {});
  if (g.type !== 'Polygon') throw new Error('Only Polygon supported');
  return { rings: g.coordinates, spatialReference: { wkid: 4326 } };
}

app.post('/api/arcgis/query', async (req, res) => {
  try {
    const { layerUrl, geometry, outFields='*' } = req.body || {};
    if (!layerUrl) return res.status(400).json({ error: 'layerUrl required' });
    if (!isAllowedArcGisUrl(layerUrl)) return res.status(403).json({ error: 'ArcGIS host not allowed' });

    const esriGeom = geoJSONtoEsriPolygon(geometry);
    const params = new URLSearchParams({
      f: 'json',
      returnGeometry: 'true',
      outFields,
      spatialRel: 'esriSpatialRelIntersects',
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      outSR: '4326',
      geometry: JSON.stringify(esriGeom)
    });

    const arcUrl = `${layerUrl}/query`;
    const r = await fetch(arcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const text = await r.text();
    try { res.json(JSON.parse(text)); } catch { res.send(text); }
  } catch (e) {
    console.error('ArcGIS query error:', e);
    res.status(500).json({ error: String(e) });
  }
});
