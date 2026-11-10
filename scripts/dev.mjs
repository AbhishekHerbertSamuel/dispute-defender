import { spawn } from 'node:child_process';
const children = ['dev:api', 'dev:web'].map(script => spawn('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' }));
let exiting = false;
function stop(code = 0) { if (exiting) return; exiting = true; children.forEach(c => c.kill('SIGTERM')); process.exitCode = code; }
children.forEach(c => c.on('exit', code => stop(code || 0)));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
