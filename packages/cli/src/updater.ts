import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { getOctokit, context } from '@actions/github';
import c from 'kleur';

import { $argv } from './utils';
import type { Platform, UpdaterJSON } from './types';

import updatelog from './updatelog';

export default async function updater() {
  const argv = $argv();
  let owner, repo;

  try {
    owner = context?.repo?.owner;
    repo = context?.repo?.repo;
  } catch(_) {
    if (argv.owner) {
      owner = argv.owner;
    }
    if (argv.repo) {
      repo = argv.repo;
    }
  }

  if (!owner || !owner || !argv.token) {
    console.log(c.red('[💢 updater]'), '`owner`, `repo`, `token` are required.');
    process.exit(0);
  }

  let filename = 'install.json';
  if (argv.output) {
    if (!fs.existsSync(path.dirname(argv.output))) {
      fs.mkdirSync(path.dirname(argv.output), { recursive: true });
    }
    filename = argv.output;
    if (!/.json$/.test(filename)) {
      console.log(c.red('[💢 updater]'), c.yellow(filename), `The output file format must be json`);
      process.exit(0);
    }
  }

  const options = { owner, repo };
  const github = getOctokit(argv.token);

  const { data: tags } = await github.rest.repos.listTags({
    ...options,
    per_page: 10,
    page: 1,
  });

  const tag = tags.find((t) => t.name.startsWith('v'));
  // console.log(`${JSON.stringify(tag, null, 2)}`);

  if (!tag) return;

  const { data: latestRelease } = await github.rest.repos.getReleaseByTag({
    ...options,
    tag: tag.name,
  });

  const { content } = updatelog(tag.name);

  const updateData: UpdaterJSON = {
    version: tag.name,
    notes: content, // use UPDATE_LOG.md
    pub_date: new Date().toISOString(),
    platforms: {
      win64: { signature: '', url: '' }, // compatible with older formats
      linux: { signature: '', url: '' }, // compatible with older formats
      darwin: { signature: '', url: '' }, // compatible with older formats
      'darwin-aarch64': { signature: '', url: '' },
      'darwin-x86_64': { signature: '', url: '' },
      'linux-x86_64': { signature: '', url: '' },
      'windows-x86_64': { signature: '', url: '' },
      // 'windows-i686': { signature: '', url: '' }, // no supported
    },
  };

  const setAsset = async (asset: any, reg: RegExp, platforms: Platform[]) => {
    let sig = '';
    if (/.sig$/.test(asset.name)) {
      sig = await getSignature(asset.browser_download_url);
    }
    platforms.forEach((platform: Platform) => {
      if (reg.test(asset.name)) {
        // platform signature
        if (sig) {
          updateData.platforms[platform].signature = sig;
          return;
        }
        // platform url
        updateData.platforms[platform].url = asset.browser_download_url;
      }
    });
  };

  const promises = latestRelease.assets.map(async (asset) => {
    // windows
    await setAsset(asset, /.msi.zip/, ['win64', 'windows-x86_64']);

    // darwin
    await setAsset(asset, /.app.tar.gz/, [
      'darwin',
      'darwin-x86_64',
      'darwin-aarch64',
    ]);

    // linux
    await setAsset(asset, /.AppImage.tar.gz/, ['linux', 'linux-x86_64']);
  });
  await Promise.allSettled(promises);

  fs.writeFileSync(filename, JSON.stringify(updateData, null, 2));
  console.log(c.green('[✨ updater]'), c.green(filename));
}

// get the signature file content
async function getSignature(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    return response.text();
  } catch (_) {
    return '';
  }
}