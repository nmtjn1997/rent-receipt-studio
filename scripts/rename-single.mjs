import { renameSync } from 'node:fs';
renameSync('dist-single/index.html', 'dist-single/rent-receipt.html');
console.log('dist-single/rent-receipt.html ready (open it directly, no server needed).');
