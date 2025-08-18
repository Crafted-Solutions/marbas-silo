
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { glob } = require('fast-glob');

const execAsync = promisify(exec);
const writeAsync = promisify(fs.writeFile);
module.exports = {
	xgtHandlebarsPot: async function xgtHandlebarsPot(inputDir, output, options = {}) {
		const hbs = await glob(`**/*.hbs`, { cwd: `${inputDir}/`, nodir: true });

		let cwdBack;
		try {
			if (options.cwd) {
				cwdBack = process.cwd();
				process.chdir(options.cwd);
				inputDir = path.relative(options.cwd, inputDir);
			}
			let cmd = `npx xgettext-template -D "${inputDir}" -o "${output}" -L Handlebars --from-code utf-8 `;
			if (options.packageName) {
				cmd += `--package-name="${options.packageName}" `;
			}
			if (options.packageVersion) {
				cmd += `--package-version="${options.packageVersion}" `;
			}
			if (options.copyrightHolder) {
				cmd += `--copyright-holder="${options.copyrightHolder}" `;
			}
			if (options.email) {
				cmd += `--msgid-bugs-address="${options.email}" `;
			}
			cmd += hbs.reduce((accu, curr) => {
				if (accu) {
					accu += ' ';
				}
				accu += `"${curr}"`;
				return accu;
			}, '');
			console.info("Extracting gettext data from", hbs);
			await execAsync(cmd);

		} finally {
			if (cwdBack) {
				process.chdir(cwdBack);
			}
		}
	},
	xgtJsPot: async function xgtJsPot(inputDir, output, options = {}) {
		const cmd = `npx ttag extract --foldLength=1000 -o "${output}" "${inputDir}"`;
		console.info("Extracting gettext data from JS in", inputDir);
		await execAsync(cmd);
	},
	xgtUpdatePo: async function xgtUpdatePo(inputDir, outputDir, locales, basename) {
		await Promise.all(locales.map(async (locale) => {
			const poPath = path.resolve(outputDir, `${basename}.${locale}.po`);
			if (fs.existsSync(poPath)) {
				console.info("Updating", poPath);
			} else {
				console.info("Generating", poPath);
				let cmd = `npx ttag init ${locale} "${poPath}"`;
				await execAsync(cmd);
			}
			let cmd = `npx ttag update "${poPath}" "${inputDir}"`;
			await execAsync(cmd);
		}));
	},
	xgtMergePo: async function xgtMergePo(potFile, outputDir, locales, basename = null) {
		await Promise.all(locales.map(async (locale) => {
			if (!fs.existsSync(potFile)) {
				console.warn(`${potFile} not found, skipping PO generation`);
				return;
			}
			if (!basename) {
				basename = path.basename(potFile, '.pot');
			}
			const poPath = path.resolve(outputDir, `${basename}.${locale}.po`);
			if (fs.existsSync(poPath)) {
				console.info("Updating", poPath);
			} else {
				console.info("Generating", poPath);
				let cmd = `npx ttag init ${locale} "${poPath}"`;
				await execAsync(cmd);
			}
			let cmd = `npx ttag merge "${poPath}" "${potFile}"`;
			const res = await execAsync(cmd);
			await writeAsync(poPath, res.stdout, { encoding: 'utf-8' });
		}));
	},
	xgtGetJson: async function xgtGetJson(poFile, output = null) {
		const cmd = `npx ttag po2json "${poFile}" --format=compact`;
		const res = await execAsync(cmd);
		if (output && 'string' !== output) {
			await writeAsync(output, res.stdout, { encoding: 'utf-8' });
			return {};
		}
		return 'string' === output ? res.stdout : JSON.parse(res.stdout);
	}
};