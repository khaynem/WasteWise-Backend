// const L = require('leaflet');
// const maplibregl = require('maplibre-gl');
// const { ORS } = require('openrouteservice-js');
// const fetch = require('node-fetch');

// // 1. MapLibre GL + Leaflet integration
// function createMapLibreLeafletMap(mapContainerId, mapLibreOptions, leafletOptions) {
//   // Create Leaflet map
//   const leafletMap = L.map(mapContainerId, leafletOptions);

//   // Add MapLibre GL layer
//   const maplibreLayer = L.maplibreGL({
//     style: mapLibreOptions.style,
//     accessToken: mapLibreOptions.accessToken || undefined,
//   }).addTo(leafletMap);

//   return { leafletMap, maplibreLayer };
// }

// // 2. OpenRouteService client setup
// const orsClient = new ORS({
//   api_key: process.env.ORS_API_KEY || 'YOUR_ORS_API_KEY',
// });

// function getRoute({ coordinates, profile = 'driving-car' }) {
//   return orsClient.directions({
//     coordinates,
//     profile,
//     format: 'geojson',
//   });
// }

// // 3. Nominatim geocoding
// async function geocode(query) {
//   const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
//   const response = await fetch(url, {
//     headers: { 'User-Agent': 'WasteWise/1.0 (your@email.com)' },
//   });
//   if (!response.ok) throw new Error('Nominatim geocoding failed');
//   return response.json();
// }

// async function reverseGeocode(lat, lon) {
//   const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
//   const response = await fetch(url, {
//     headers: { 'User-Agent': 'WasteWise/1.0 (your@email.com)' },
//   });
//   if (!response.ok) throw new Error('Nominatim reverse geocoding failed');
//   return response.json();
// }

// module.exports = {
//   createMapLibreLeafletMap,
//   getRoute,
//   geocode,
//   reverseGeocode,
// };
