const mapService = require('../services/maps');

// Olongapo City, Philippines coordinates
const OLONGAPO_COORDINATES = {
  lat: 14.8874,
  lng: 120.3666
};

const DEFAULT_ZOOM = 13;

// Initialize map centered on Olongapo City
exports.initializeMap = async (req, res) => {
  try {
    // This would typically be used client-side, but we're providing the config
    const mapConfig = {
      center: OLONGAPO_COORDINATES,
      zoom: DEFAULT_ZOOM,
      maplibreOptions: {
        style: 'https://demotiles.maplibre.org/style.json', // Free tile source
      },
      leafletOptions: {
        preferCanvas: true
      }
    };
    
    res.status(200).json({ success: true, mapConfig });
  } catch (error) {
    console.error('Map initialization error:', error);
    res.status(500).json({ success: false, message: 'Failed to initialize map', error: error.message });
  }
};

// Search for places by name/address
exports.searchPlace = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const results = await mapService.geocode(query);
    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Place search error:', error);
    res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
};

// Get details of a location by coordinates
exports.getLocationDetails = async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const details = await mapService.reverseGeocode(lat, lon);
    res.status(200).json({ success: true, details });
  } catch (error) {
    console.error('Location details error:', error);
    res.status(500).json({ success: false, message: 'Failed to get location details', error: error.message });
  }
};

// Get directions between two points
exports.getDirections = async (req, res) => {
  try {
    const { startLat, startLon, endLat, endLon, profile } = req.query;
    
    if (!startLat || !startLon || !endLat || !endLon) {
      return res.status(400).json({ success: false, message: 'Start and end coordinates are required' });
    }

    const coordinates = [
      [parseFloat(startLon), parseFloat(startLat)],
      [parseFloat(endLon), parseFloat(endLat)]
    ];

    const routeProfile = profile || 'driving-car';
    const route = await mapService.getRoute({ coordinates, profile: routeProfile });
    
    res.status(200).json({ success: true, route });
  } catch (error) {
    console.error('Directions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get directions', error: error.message });
  }
};

// Get waste collection points near a location
exports.getNearbyWastePoints = async (req, res) => {
  try {
    const { lat, lon, radius } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    // This would typically query your database for waste collection points
    // For now, returning mock data centered around the provided coordinates
    const searchRadius = radius || 2000; // meters
    
    // Mock data - in a real app, this would come from your database
    const mockWastePoints = [
      {
        id: 'wp1',
        name: 'Olongapo City Recycling Center',
        type: 'recycling',
        lat: parseFloat(lat) + 0.01,
        lon: parseFloat(lon) + 0.01
      },
      {
        id: 'wp2',
        name: 'Community Waste Collection Point',
        type: 'general',
        lat: parseFloat(lat) - 0.005,
        lon: parseFloat(lon) + 0.008
      },
      {
        id: 'wp3',
        name: 'E-Waste Drop-off',
        type: 'electronic',
        lat: parseFloat(lat) + 0.008,
        lon: parseFloat(lon) - 0.003
      }
    ];
    
    res.status(200).json({ success: true, wastePoints: mockWastePoints });
  } catch (error) {
    console.error('Nearby waste points error:', error);
    res.status(500).json({ success: false, message: 'Failed to get nearby waste points', error: error.message });
  }
};

// Find optimal route to multiple waste collection points
exports.getWasteCollectionRoute = async (req, res) => {
  try {
    const { points } = req.body;
    
    if (!points || !Array.isArray(points) || points.length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least two valid points are required for routing' 
      });
    }

    // Format coordinates for ORS
    const coordinates = points.map(point => [parseFloat(point.lon), parseFloat(point.lat)]);
    
    // Get route through all points
    const route = await mapService.getRoute({ 
      coordinates, 
      profile: 'driving-car' 
    });
    
    res.status(200).json({ success: true, route });
  } catch (error) {
    console.error('Waste collection route error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to calculate waste collection route', 
      error: error.message 
    });
  }
};