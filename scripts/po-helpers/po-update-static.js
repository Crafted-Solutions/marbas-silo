const fs = require('fs');
const path = require('path');
const { xgtHandlebarsPot, xgtMergePo } = require('xgettext-helpers');

const appDir = '../..';
const { config } = require(path.resolve(__dirname, appDir, 'package.json'));

async function main() {
	const srcDir = path.resolve(__dirname, appDir, 'src');
	const i18nDir = path.resolve(__dirname, appDir, 'i18n');
	if (!fs.existsSync(i18nDir)) {
		fs.mkdirSync(i18nDir);
	}

	const staticPot = path.resolve(__dirname, '../../i18n/static.pot');
	await xgtHandlebarsPot(srcDir, staticPot, {
		cwd: path.resolve(__dirname, appDir)
	});
	await xgtMergePo(staticPot, i18nDir, config.locales.filter((val => val != config.defaultLocale)));
}

main().catch(console.error);
