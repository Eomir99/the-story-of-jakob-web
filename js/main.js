import { startGame } from './game.js';
import { initUI } from './ui.js';

const canvas = document.querySelector('#game');
initUI();
startGame(canvas);

console.info('The Story of Jakob: game loop started.');
