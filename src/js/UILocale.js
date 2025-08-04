import { useLocale, addLocale, gettext } from 'ttag';
import { StorageUtils } from './cmn/StorageUtils';

let vendorMsgs;
if (_DEVELOPMENT_) {
	vendorMsgs = {};
	global.getVendorPot = function () {
		return Object.keys(vendorMsgs).reduce((accu, curr) => {
			if (accu) {
				accu += '\n\n';
			}
			accu += `#: vendor source ${vendorMsgs[curr]}\nmsgid ${JSON.stringify(curr)}\nmsgstr ""`;
			return accu;
		}, '');
	};
	global.getVendorPotSrc = function () {
		return Object.keys(vendorMsgs).reduce((accu, curr) => {
			if (accu) {
				accu += '\n\n';
			}
			accu +=
				`// vendor source ${vendorMsgs[curr]}
t\`${curr}\`;`;
			return accu;
		}, '');
	};
}

export const UILocale = {
	init: async function init() {
		const locale = UILocale.current = document.documentElement.lang;
		if (UILocale.detectAndSwitch()) {
			return true;
		}
		if (!UILocale.isDefault()) {
			const localeData = await import(/* webpackChunkName: "[request]" */ `../../i18n/index.${locale}.po`);
			if (localeData && localeData.default) {
				addLocale(locale, localeData.default);
				useLocale(locale);
			}
		}

		document.querySelectorAll('.locale-link').forEach(link => {
			const loc = link.getAttribute('data-locale');
			link.href = (new URL(`index${EnvConfig.defaultLocale == loc ? '' : `.${loc}`}.html`, document.baseURI)).href;
			link.addEventListener('click', () => {
				StorageUtils.write('locale', loc);
			});
		});
		return false;
	},
	isDefault: function isDefault() {
		return UILocale.current == EnvConfig.defaultLocale;
	},
	detectAndSwitch: function detectAndSwitch() {
		if (!UILocale.isDefault()) {
			return false;
		}
		let switchTo;
		if (EnvConfig.locales && EnvConfig.locales.length) {
			switchTo = StorageUtils.read('locale');
			if (switchTo && 0 > EnvConfig.locales.indexOf(switchTo)) {
				switchTo = null;
			}
			if (!switchTo) {
				switchTo = EnvConfig.locales.filter(val => {
					return val == navigator.language || navigator.language.startsWith(`${val}-`);
				})[0];
			}
		}
		if (!switchTo) {
			StorageUtils.write('locale', null);
		} else if (switchTo != UILocale.current) {
			location.replace(new URL(`index.${switchTo}.html`, document.baseURI));
			return true;
		}
		return false;
	},
	tranlsate: function tranlsate(txt, context = undefined, source = undefined) {
		if (txt && !UILocale.isDefault()) {
			if (_DEVELOPMENT_) {
				vendorMsgs[txt] = source || "";
			}
			const _gt = gettext;
			return _gt(txt);
		}
		return txt;
	}
};