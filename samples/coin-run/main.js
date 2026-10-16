import Phaser from 'phaser';
import { project, scenes, scripts } from 'virtual:phaseform';
import { build, loadAssets } from 'phaseform-loader';

const entry = project.scenes.find(s => s.key === project.entry);

class PhaseformScene extends Phaser.Scene {
  constructor(key) { super(key); this.sceneKey = key; }
  preload() { loadAssets(this, project, project.scenes.find(s => s.key === this.sceneKey).assets); }
  create() {
    const { warnings } = build(this, scenes[this.sceneKey], { modules: scripts, animations: project.animations });
    for (const w of warnings) console.warn(w);
    window.__ready = true;
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: scenes[entry.key].size.width,
  height: scenes[entry.key].size.height,
  scene: project.scenes.map(s => new PhaseformScene(s.key)),
});
