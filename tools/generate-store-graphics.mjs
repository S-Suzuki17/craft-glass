import { spawnSync } from 'node:child_process';

const res = spawnSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'D:/Development/craft-glass/tools/generate-store-graphics.ps1'],
  { stdio: 'inherit' }
);
if (res.status !== 0) process.exit(res.status || 1);
