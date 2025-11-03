export interface City {
  name: string;
  lat: number;
  lon: number;
  minRadius: number;
  maxRadius: number;
}

export const cities: City[] = [
  { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, minRadius: 800, maxRadius: 2000 },
  { name: 'Paris, France', lat: 48.8566, lon: 2.3522, minRadius: 600, maxRadius: 1500 },
  { name: 'New York, USA', lat: 40.7128, lon: -74.0060, minRadius: 800, maxRadius: 2000 },
  { name: 'London, UK', lat: 51.5074, lon: -0.1278, minRadius: 700, maxRadius: 1800 },
  { name: 'Amsterdam, Netherlands', lat: 52.3676, lon: 4.9041, minRadius: 500, maxRadius: 1200 },
  { name: 'Barcelona, Spain', lat: 41.3851, lon: 2.1734, minRadius: 600, maxRadius: 1500 },
  { name: 'Venice, Italy', lat: 45.4408, lon: 12.3155, minRadius: 400, maxRadius: 1000 },
  { name: 'San Francisco, USA', lat: 37.7749, lon: -122.4194, minRadius: 700, maxRadius: 1800 },
  { name: 'Seattle, USA', lat: 47.6062, lon: -122.3321, minRadius: 700, maxRadius: 1600 },
  { name: 'Portland, USA', lat: 45.5152, lon: -122.6784, minRadius: 600, maxRadius: 1400 },
  { name: 'Boston, USA', lat: 42.3601, lon: -71.0589, minRadius: 700, maxRadius: 1600 },
  { name: 'Chicago, USA', lat: 41.8781, lon: -87.6298, minRadius: 800, maxRadius: 2000 },
  { name: 'Montreal, Canada', lat: 45.5017, lon: -73.5673, minRadius: 700, maxRadius: 1600 },
  { name: 'Vancouver, Canada', lat: 49.2827, lon: -123.1207, minRadius: 600, maxRadius: 1500 },
  { name: 'Rome, Italy', lat: 41.9028, lon: 12.4964, minRadius: 700, maxRadius: 1700 },
  { name: 'Berlin, Germany', lat: 52.5200, lon: 13.4050, minRadius: 800, maxRadius: 1800 },
  { name: 'Copenhagen, Denmark', lat: 55.6761, lon: 12.5683, minRadius: 600, maxRadius: 1400 },
  { name: 'Stockholm, Sweden', lat: 59.3293, lon: 18.0686, minRadius: 600, maxRadius: 1500 },
  { name: 'Prague, Czech Republic', lat: 50.0755, lon: 14.4378, minRadius: 600, maxRadius: 1400 },
  { name: 'Vienna, Austria', lat: 48.2082, lon: 16.3738, minRadius: 600, maxRadius: 1500 },
  { name: 'Istanbul, Turkey', lat: 41.0082, lon: 28.9784, minRadius: 800, maxRadius: 2000 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198, minRadius: 700, maxRadius: 1600 },
  { name: 'Mumbai, India', lat: 19.0760, lon: 72.8777, minRadius: 800, maxRadius: 2000 },
  { name: 'São Paulo, Brazil', lat: -23.5505, lon: -46.6333, minRadius: 800, maxRadius: 2000 },
  { name: 'Buenos Aires, Argentina', lat: -34.6037, lon: -58.3816, minRadius: 700, maxRadius: 1700 },
  { name: 'Sydney, Australia', lat: -33.8688, lon: 151.2093, minRadius: 700, maxRadius: 1700 },
  { name: 'Melbourne, Australia', lat: -37.8136, lon: 144.9631, minRadius: 700, maxRadius: 1600 },
  { name: 'Kyoto, Japan', lat: 35.0116, lon: 135.7681, minRadius: 500, maxRadius: 1300 },
  { name: 'Edinburgh, Scotland', lat: 55.9533, lon: -3.1883, minRadius: 500, maxRadius: 1200 },
  { name: 'Lisbon, Portugal', lat: 38.7223, lon: -9.1393, minRadius: 600, maxRadius: 1400 },
  { name: 'Dublin, Ireland', lat: 53.3498, lon: -6.2603, minRadius: 600, maxRadius: 1400 },
  { name: 'Budapest, Hungary', lat: 47.4979, lon: 19.0402, minRadius: 600, maxRadius: 1500 },
  { name: 'Athens, Greece', lat: 37.9838, lon: 23.7275, minRadius: 600, maxRadius: 1500 },
  { name: 'Austin, USA', lat: 30.2672, lon: -97.7431, minRadius: 700, maxRadius: 1600 },
  { name: 'Toronto, Canada', lat: 43.6532, lon: -79.3832, minRadius: 800, maxRadius: 1800 },
];

export function getRandomCity(): City {
  return cities[Math.floor(Math.random() * cities.length)];
}

export function getRandomRadius(city: City): number {
  return Math.floor(Math.random() * (city.maxRadius - city.minRadius + 1)) + city.minRadius;
}
