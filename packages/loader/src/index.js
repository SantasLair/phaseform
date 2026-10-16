import Phaser from 'phaser';
import { createLoader } from './loader.js';

const { build, clear, loadAssets } = createLoader(Phaser);
export { build, clear, loadAssets, createLoader };
