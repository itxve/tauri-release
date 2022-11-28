
import { execSync } from 'child_process';
import fs from 'fs';

import { packageJSON } from './utils';
import updatelog from './updatelog';

async function release() {
  const flag = process.argv[2] ?? 'patch';
  const packageJson = packageJSON();
  let [a, b, c] = packageJson.version.split('.').map(Number);

  if (flag === 'major') {
    a += 1;
    b = 0;
    c = 0;
  } else if (flag === 'minor') {
    b += 1;
    c = 0;
  } else if (flag === 'patch') {
    c += 1;
  } else {
    console.log(`Invalid flag "${flag}"`);
    process.exit(1);
  }

  const nextVersion = `${a}.${b}.${c}`;
  packageJson.version = nextVersion;

  const nextTag = `v${nextVersion}`;
  await updatelog(nextTag, 'release');

  // rewrite package.json
  fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));

  console.log('«36» /scripts/src/release.ts ~> ', 'ok');


  // execSync('git add ./package.json ./UPDATE_LOG.md');
  // execSync(`git commit -m "v${nextVersion}"`);
  // execSync(`git tag -a v${nextVersion} -m "v${nextVersion}"`);
  // execSync(`git push`);
  // execSync(`git push origin v${nextVersion}`);
  // console.log(`Publish Successfully...`);
}

release()
  .catch(console.error);