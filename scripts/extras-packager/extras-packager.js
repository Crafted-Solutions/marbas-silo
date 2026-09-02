const path = require("node:path");
const util = require("node:util");
const fs = require("fs");
const archiver = require("archiver");

const MANIFEST_NAME = 'manifest.json';

function buildPackage(packageDef, outputDir) {
	return new Promise((resolve, reject) => {
		try {
			let mergedManifest;
			if (1 < packageDef.sources.length) {
				mergedManifest = {};
				for (const src of packageDef.sources) {
					const manifest = require(path.resolve(src, MANIFEST_NAME));
					for (const k in manifest) {
						if ('anchorGrainIds' == k) {
							if (!mergedManifest[k]) {
								mergedManifest[k] = [];
							}
							mergedManifest[k].push(...manifest[k]);
						} else {
							mergedManifest[k] = manifest[k];
						}
					}
				}
				// console.log(packageDef.name, "mergedManifest", mergedManifest);
			}
			const outputPath = path.resolve(outputDir, `${packageDef.name}.zip`);
			console.info(`Creating ${outputPath}`);

			const zip = new archiver.ZipArchive({ zlib: { level: 9 } });
			zip.on('error', reject);
			const stream = fs.createWriteStream(outputPath);
			stream.on('close', resolve);
			zip.pipe(stream);

			for (const src of packageDef.sources) {
				// zip.directory(src, false);
				zip.glob(`!**/${MANIFEST_NAME}`, { cwd: src });
			}
			if (mergedManifest) {
				zip.append(JSON.stringify(mergedManifest), { name: MANIFEST_NAME });
			} else {
				zip.file(path.resolve(packageDef.sources[0], MANIFEST_NAME), { name: MANIFEST_NAME });
			}
			zip.finalize();

		} catch (e) {
			reject(e);
		}
	});
}

async function buildExtras(projectRoot = "../..") {
	const baseDir = path.resolve(__dirname, projectRoot || "../..");
	const { config } = require(path.resolve(baseDir, 'package.json'));
	if (config.extras && config.extras.length) {
		for (const item of config.extras) {
			const packageDef = {};
			if ('string' == typeof item) {
				packageDef.name = item;
				packageDef.sources = [path.resolve(baseDir, 'extras', item)];
			} else {
				packageDef.name = item.name;
				packageDef.sources = item.sources.map(s => path.resolve(baseDir, 'extras', s));
			}
			const outputDir = path.resolve(baseDir, 'build');
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir);
			}
			await buildPackage(packageDef, outputDir);
		}
	} else {
		console.info("No extras to package");
	}
}

async function main() {
	const { values } = util.parseArgs({
		options: {
			projectRoot: {
				type: 'string',
				short: 'p'
			}
		},
		strict: true
	});
	await buildExtras(values.projectRoot);
}

main();
