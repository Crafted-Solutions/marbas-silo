const fs = require('fs');
const path = require('path');
const { xgtJsPot, xgtUpdatePo } = require('xgettext-helpers');

const appDir = '../..';
const { config } = require(path.resolve(__dirname, appDir, 'package.json'));

async function main() {
	const srcDir = path.resolve(__dirname, appDir, 'src');
	const i18nDir = path.resolve(__dirname, appDir, 'i18n');
	if (!fs.existsSync(i18nDir)) {
		fs.mkdirSync(i18nDir);
	}

	const dynamicPot = path.resolve(__dirname, appDir, 'i18n/index.pot');
	await xgtJsPot(srcDir, dynamicPot);
	await xgtUpdatePo(srcDir, i18nDir, config.locales.filter((val => val != config.defaultLocale)), path.basename(dynamicPot, '.pot'));
}

main().catch(console.error);
