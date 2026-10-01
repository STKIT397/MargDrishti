/**
 * MargDrishti — Location Intelligence & Geolocation Service
 * Browser GPS acquisition with seamless Demo Location fallback and Leaflet GIS integration.
 */

export const GeoService = {
  // Standard high-accuracy demo location for Bengaluru Smart City showcase
  DEMO_FALLBACK: {
    latitude: 12.9784,
    longitude: 77.6408,
    roadName: '100 Feet Road, Indiranagar',
    ward: 'Ward 80 - Hoysala Nagar',
    landmark: 'Opposite Metro Pillar 84, near 12th Main',
    city: 'Bengaluru',
    accuracy: 4.5,
    source: 'DEMO_LOCATION'
  },

  async acquireLocation() {
    if (!('geolocation' in navigator)) {
      return { ...this.DEMO_FALLBACK, note: 'Geolocation API not supported by browser. Loaded Demo Location.' };
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 30000
        });
      });

      const lat = Number(position.coords.latitude.toFixed(5));
      const lng = Number(position.coords.longitude.toFixed(5));

      return {
        latitude: lat,
        longitude: lng,
        roadName: 'Main Arterial Corridor',
        ward: 'Central Municipal Ward',
        landmark: 'Near GPS Acquired Coordinates',
        city: 'Bengaluru',
        accuracy: position.coords.accuracy ? Math.round(position.coords.accuracy) : 5,
        source: 'CURRENT_DEVICE_LOCATION'
      };
    } catch (err) {
      console.warn('Geolocation acquisition timed out or permission denied. Using Demo Location fallback.', err);
      return {
        ...this.DEMO_FALLBACK,
        note: 'Browser GPS access denied or timed out. Loaded verified Demo Location.'
      };
    }
  },

  /**
   * Initializes or updates an interactive Leaflet map instance
   */
  initLeafletMap(containerId, coords, options = {}) {
    if (!window.L || !document.getElementById(containerId)) return null;

    const [lat, lng] = [coords.latitude, coords.longitude];
    const zoomLevel = options.zoom || 15;

    // Check if map instance already exists on this container
    const container = document.getElementById(containerId);
    if (container._leaflet_id) {
      container._leaflet_id = null;
      container.innerHTML = '';
    }

    const map = window.L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([lat, lng], zoomLevel);

    // Clean OpenStreetMap tiles
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Custom glowing pinpoint icon
    const customIcon = window.L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 26px; height: 26px; background: rgba(6, 182, 212, 0.35); border-radius: 50%; animation: pulse-dot 1.5s infinite;"></div>
          <div style="width: 14px; height: 14px; background: #0891b2; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.4); z-index: 2;"></div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const marker = window.L.marker([lat, lng], {
      icon: customIcon,
      draggable: options.draggable || false
    }).addTo(map);

    const popupHtml = `
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
        <strong style="color: #0891b2;">${options.title || coords.roadName || 'Damage Location'}</strong><br/>
        <span style="color: #64748b;">${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}</span><br/>
        <span style="display: inline-block; margin-top: 3px; font-size: 10px; font-weight: 700; color: #059669;">
          [${coords.source === 'CURRENT_DEVICE_LOCATION' ? 'GPS FIX' : 'DEMO LOCATION'}]
        </span>
      </div>
    `;
    marker.bindPopup(popupHtml);

    if (options.draggable) {
      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        if (options.onDragEnd) {
          options.onDragEnd({
            latitude: Number(newPos.lat.toFixed(5)),
            longitude: Number(newPos.lng.toFixed(5))
          });
        }
      });
    }

    return { map, marker };
  }
};
