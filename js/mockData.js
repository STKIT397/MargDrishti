/**
 * MargDrishti — High-Fidelity Mock Seed Data & Preset Curations
 * Realistic Indian road damage datasets, GIS coordinates, and lifecycle records.
 */

export const SAMPLE_ROAD_IMAGES = {
  pothole_severe: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=1000&q=80',
  pothole_medium: 'https://images.unsplash.com/photo-1584463699039-38374972412e?auto=format&fit=crop&w=1000&q=80',
  cracks_alligator: 'https://images.unsplash.com/photo-1578983424935-7a45610ecfb3?auto=format&fit=crop&w=1000&q=80',
  cracks_transverse: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80',
  repaired_road: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=1000&q=80'
};

export const SAMPLE_VIDEO_PREVIEWS = {
  dashcam_pothole: {
    title: 'Indiranagar Arterial Dashcam (14s)',
    duration: '00:14',
    framesAnalyzed: 12,
    framesWithDetections: 4,
    highestConfidence: 0.91,
    evidenceTimestamp: '00:08',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-driving-down-a-busy-city-street-4155-large.mp4',
    representativeFrame: SAMPLE_ROAD_IMAGES.pothole_severe
  },
  dashcam_cracks: {
    title: 'Hosur Highway Transition (10s)',
    duration: '00:10',
    framesAnalyzed: 10,
    framesWithDetections: 5,
    highestConfidence: 0.88,
    evidenceTimestamp: '00:04',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-car-driving-on-the-road-during-sunset-34320-large.mp4',
    representativeFrame: SAMPLE_ROAD_IMAGES.cracks_alligator
  }
};

export const DEMO_OFFICERS = [
  {
    id: 'OFF-01',
    name: 'Rajesh Kumar',
    designation: 'Assistant Executive Engineer',
    department: 'Zonal Road Infrastructure Division',
    phone: '+91 98450 12345',
    zone: 'East Zone - Indiranagar'
  },
  {
    id: 'OFF-02',
    name: 'Priya Sharma',
    designation: 'Junior Engineer (Civil)',
    department: 'Asphalt & Quality Assurance Cell',
    phone: '+91 97412 56789',
    zone: 'South Zone - Koramangala'
  },
  {
    id: 'OFF-03',
    name: 'Anand Verma',
    designation: 'Field Road Inspector',
    department: 'Rapid Response Patching Squad',
    phone: '+91 94481 99887',
    zone: 'Central Zone - MG Road'
  }
];

// Initial complaints start empty — real complaints are created by citizens through the workflow
export const INITIAL_SEED_COMPLAINTS = [];


