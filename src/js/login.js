import { t } from "ttag";
if (window.opener) {
	window.opener.postMessage({
		type: 'login-complete',
		params: new URLSearchParams(window.location.search).toString()
	});
} else {
	// most likely new registration callback
	setTimeout(() => {
		document.querySelector('h1').textContent = t`You can close this window`;
		window.close();
	}, 100);
}
const locale = document.documentElement.lang;
if (locale != EnvConfig.defaultLocale) {
	const localeData = await import(/* webpackChunkName: "[request]" */ `../../i18n/index.${locale}.po`);
	if (localeData && localeData.default) {
		addLocale(locale, localeData.default);
		useLocale(locale);
	}
}
document.querySelector('h1').textContent = t`Processing authorization provider response...`;
const title = document.title.split(" - ");
document.title = t`${title[0]} - Authorization Receiver`;
