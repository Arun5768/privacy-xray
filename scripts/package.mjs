// Zips dist/ into docs/privacy-xray-extension.zip for the website download.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const out = 'docs/privacy-xray-extension.zip';
rmSync(out, { force: true });
if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path dist/* -DestinationPath ${out}`], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-qr', `../${out}`, '.'], { cwd: 'dist', stdio: 'inherit' });
}
console.log(`wrote ${out}`);
