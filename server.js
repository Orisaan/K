// server.js — Proxy for GovMap + ArcGIS TLV (Render-ready, ESM)
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;
const GOVMAP_BASE = process.env.GOVMAP_BASE || 'https://api.govmap.gov.il';
const GOVMAP_TOKEN = process.env.GOVMAP_TOKEN || '';

// Allow-list
const ALLOWED_ARCGIS_HOSTS = new Set((process.env.ALLOWED_ARCGIS_HOSTS || 'gisn.tel-aviv.gov.il').split(',').map(s => s.trim()));

// Serve static files
app.use('/', express.static(path.join(__dirname, 'public')));

function isAllowedArcGisUrl(urlStr) {
  try { const u = new URL(urlStr); return ALLOWED_ARCGIS_HOSTS.has(u.hostname); } catch { return false; }
}

async function fwdGet(url, headers = {}) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function fwdPost(url, body, headers = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

// GovMap routes
app.get('/api/govmap/addressToLotParcel', async (req, res) => {
  try {
    const text = req.query.text || '';
    const url = `${GOVMAP_BASE}/addressToLotParcel?text=${encodeURIComponent(text)}`;
    const headers = GOVMAP_TOKEN ? { Authorization: `Bearer ${GOVMAP_TOKEN}` } : {};
    const data = await fwdGet(url, headers);
    res.json(data);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/govmap/lotParcelGeometry', async (req, res) => {
  try {
    const gush = req.query.gush || '';
    const helka = req.query.helka || '';
    const url = `${GOVMAP_BASE}/lotParcelToGeometry?gush=${encodeURIComponent(gush)}&helka=${encodeURIComponent(helka)}`;
    const headers = GOVMAP_TOKEN ? { Authorization: `Bearer ${GOVMAP_TOKEN}` } : {};
    const data = await fwdGet(url, headers);
    res.json(data);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/govmap/intersect', async (req, res) => {
  try {
    const { wkt, layerName } = req.body || {};
    const url = `${GOVMAP_BASE}/intersectFeatures`;
    const headers = GOVMAP_TOKEN ? { Authorization: `Bearer ${GOVMAP_TOKEN}` } : {};
    const data = await fwdPost(url, { wkt, layerName }, headers);
    res.json(data);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ArcGIS routes
app.get('/api/arcgis/iview2/layers', async (_req, res) => {
  try {
    const url = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/layers?f=json';
    const data = await fwdGet(url);
    res.json(data);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/arcgis/query', async (req, res) => {
  try {
    const { layerUrl, geometry, outFields='*' } = req.body || {};
    if (!layerUrl) return res.status(400).json({ error: 'layerUrl required' });
    if (!isAllowedArcGisUrl(layerUrl)) return res.status(403).json({ error: 'ArcGIS host not allowed' });

    const arcUrl = `${layerUrl}/query?f=json&returnGeometry=true&outFields=${encodeURIComponent(outFields)}&spatialRel=esriSpatialRelIntersects&geometryType=esriGeometryPolygon&inSR=4326&outSR=4326`;
    const r = await fetch(arcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geometry) });
    const text = await r.text();
    try { res.json(JSON.parse(text)); } catch { res.send(text); }
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.listen(PORT, () => console.log(`Render proxy up on :${PORT}`));
