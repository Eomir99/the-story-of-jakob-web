const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');

// Milestone 0 boot check only; these are not gameplay tuning values.
context.fillStyle = '#f6c453';
context.fillRect(480, 270, 320, 180);

console.info('The Story of Jakob: canvas ready.');
