import { App } from './app/app';
import { Cheats } from './cheats';

const container = document.getElementById('app') as HTMLDivElement;
const app = new App(container);

new Cheats(app).install();

await navigator.serviceWorker.register('sw.js');
