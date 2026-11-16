import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { LumaDeskSystem } from './lumadesk.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(LumaDeskSystem);
});