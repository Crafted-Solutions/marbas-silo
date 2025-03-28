#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { argv } from 'node:process';
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// import { exec } from 'node:child_process';
import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const nodePath = await realpath(argv[1]);
const modulePath = await realpath(fileURLToPath(import.meta.url));
const isCLI = nodePath === modulePath;

if (isCLI) cliPublish();

export async function cliPublish() {
	const { values } = parseArgs({
		options: {},
		strict: false,
		allowPositionals: true,
	});

	await publish(values);
}

export async function publish() {

	const [remoteVersionsResult, newVersionsResult] = await Promise.all([
		execAsync(`npm view . version -w packages --json`),
		execAsync(`npm pkg get version -w packages --json`)
	]);

	const remoteVersions = JSON.parse(remoteVersionsResult.stdout);
	let localOutput = newVersionsResult.stdout;
	if (localOutput.startsWith('"')) {
		const arr = localOutput.split(/[\r\n]/);
		arr.splice(0, 1);
		localOutput = arr.join('\n');
	}
	const newVersions = JSON.parse(localOutput);

	for (const [pkg, version] of Object.entries(newVersions)) {
		if (remoteVersions[pkg] === version) {
			console.log(`Skipping ${pkg}@${version} because it's already published`);
			continue;
		}

		console.log(`Publishing ${pkg}@${version}`);
		// await execAsync(`npm publish -w ${pkg} --access public --provenance`);

		await new Promise((resolve, reject) => {
			const errHandler = (err) => {
				console.error("NPM error", err);
				reject(err);
			};
			try {
				// console.log(process.env);
				let cmd = 'npm';
				if ('win32' === process.platform) {
					cmd += '.cmd';
				}
				const proc = spawn(cmd, ['pack', '-w', pkg], { stdio: 'inherit', env: process.env });
				proc.on('error', errHandler);
				proc.on('close', resolve);
			} catch (e) {
				errHandler(e);
			}
		});
	}
}