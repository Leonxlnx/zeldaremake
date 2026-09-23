/** Hold one shared capslot across both sequential world boots. */
import { execFileSync } from 'node:child_process';
for (const name of ['before', 'after']) execFileSync(process.execPath,
  ['art/environment/astra-distance-real-lamina/native-capture.mjs', `art/environment/astra-distance-real-lamina/${process.argv[2] ?? ''}${name}-settings.json`],
  { stdio: 'inherit' });
