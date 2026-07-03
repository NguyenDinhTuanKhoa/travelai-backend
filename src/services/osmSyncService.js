const axios = require('axios');
const Destination = require('../models/Destination');

// Fetch POIs (Points of Interest) from OpenStreetMap (Overpass API)
// For Vietnam bounding box approx: [8.5, 102.1, 23.4, 109.5]
const fetchDestinations = async () => {
  try {
    console.log('[OSM Cron] Starting OpenStreetMap destination sync for Vietnam...');

    // Overpass QL query to fetch tourist attractions in Vietnam
    // We limit to 50 results to avoid massive payload during tests.
    // In production, you'd paginate or refine the bounding box.
    const overpassQuery = `
      [out:json][timeout:25];
      // bounding box for Vietnam roughly
      area["ISO3166-1"="VN"][admin_level=2]->.searchArea;
      (
        node["tourism"="attraction"](area.searchArea);
        way["tourism"="attraction"](area.searchArea);
        relation["tourism"="attraction"](area.searchArea);
      );
      out center 50;
    `;

    const url = 'https://overpass-api.de/api/interpreter';

    const response = await axios.post(url, `data=${encodeURIComponent(overpassQuery)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const elements = response.data.elements;

    if (!elements || elements.length === 0) {
      console.log('[OSM Cron] No new destinations found.');
      return;
    }

    let syncedCount = 0;

    for (const el of elements) {
      if (!el.tags || !el.tags.name) continue;

      const name = el.tags.name;
      const description = el.tags.description || el.tags.wikipedia || `Tourist attraction in Vietnam (${name})`;
      
      const lat = el.lat || (el.center && el.center.lat);
      const lon = el.lon || (el.center && el.center.lon);

      if (!lat || !lon) continue;

      const location = {
        city: el.tags['addr:city'] || el.tags['addr:province'] || 'Vietnam',
        country: 'Vietnam',
        coordinates: { lat, lng: lon }
      };

      // Upsert into MongoDB
      await Destination.findOneAndUpdate(
        { name: name }, // Match by name
        {
          name,
          description,
          location,
          category: 'historical', // default or parsing from tags
          $setOnInsert: {
            images: [],
            priceRange: 'budget',
            rating: 4.0,
            reviewCount: 0,
            amenities: ['Parking', 'Restrooms'],
            activities: ['Sightseeing', 'Photography']
          }
        },
        { upsert: true, new: true }
      );

      syncedCount++;
    }

    console.log(`[OSM Cron] Successfully synced ${syncedCount} destinations.`);
  } catch (error) {
    console.error('[OSM Cron] Error syncing destinations from OSM:', error.message);
  }
};

module.exports = { fetchDestinations };