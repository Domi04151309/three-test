export type TerrainOptions = {
  chunkSize: number;
  cellSize: number;
  heightScale: number;
  waterLevel: number;
  seed: number;
  lacunarity: number;
  hillOctaves: number;
  detailOctaves: number;
  hillPersistence: number;
  detailPersistence: number;
  hillNoiseScale: number;
  detailNoiseScale: number;
  hillAmplitude: number;
  detailAmplitude: number;
  elevationExponent: number;
  flatThreshold: number;
  flatBlend: number;
  chunkRadius: number;
  treePoolSize: number;
  treeNoiseScale: number;
  treeNoiseOctaves: number;
  treeNoisePersistence: number;
  maxTreesPerChunk: number;
  maxDaisiesPerChunk: number;
  flowerNoiseScale: number;
};

export const terrainOptions: TerrainOptions = {
  chunkSize: 16,
  cellSize: 10,
  heightScale: 36,
  waterLevel: 16,
  seed: 42,
  lacunarity: 2,
  hillOctaves: 5,
  detailOctaves: 5,
  hillPersistence: 0.65,
  detailPersistence: 0.5,
  hillNoiseScale: 0.004,
  detailNoiseScale: 0.03,
  hillAmplitude: 2,
  detailAmplitude: 0.9,
  elevationExponent: 1.6,
  flatThreshold: 0.35,
  flatBlend: 0.12,
  chunkRadius: 5,
  treePoolSize: 8,
  treeNoiseScale: 0.0125,
  treeNoiseOctaves: 3,
  treeNoisePersistence: 0.55,
  maxTreesPerChunk: 16,
  maxDaisiesPerChunk: 64,
  flowerNoiseScale: 0.06,
};
