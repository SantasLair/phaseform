import Phaser from 'phaser';
import { createLoader } from './loader.js';

const { build, clear } = createLoader(Phaser);
export { build, clear, createLoader };
