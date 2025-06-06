import { StorageUtils } from './cmn/StorageUtils';

const SESSIONKEY_TOKEN = 'mbs-at';
const SESSIONKEY_REFRESH_TOKEN = 'mbs-rt';
const SESSIONKEY_ID_TOKEN = 'mbs-it';
const SESSIONKEY_EXPIRATION = 'mbs-exp';
const SESSIONKEY_URL = 'mbs-url';
const SESSIONKEY_INFO = 'mbs-info';
const SESSIONKEY_STATE = 'mbs-state';
const SESSIONKEY_LOGIN_HINT = 'mbs-lhint';

export class AuthStorage {
	static get accessToken() {
		return sessionStorage.getItem(SESSIONKEY_TOKEN);
	}
	static set accessToken(value) {
		StorageUtils.write(SESSIONKEY_TOKEN, value);
	}
	static get refreshToken() {
		return sessionStorage.getItem(SESSIONKEY_REFRESH_TOKEN);
	}
	static set refreshToken(value) {
		StorageUtils.write(SESSIONKEY_REFRESH_TOKEN, value);
	}
	static get idToken() {
		return sessionStorage.getItem(SESSIONKEY_ID_TOKEN);
	}
	static set idToken(value) {
		StorageUtils.write(SESSIONKEY_ID_TOKEN, value);
	}
	static get loginHint() {
		return sessionStorage.getItem(SESSIONKEY_LOGIN_HINT);
	}
	static set loginHint(value) {
		StorageUtils.write(SESSIONKEY_LOGIN_HINT, value);
	}
	static get state() {
		return sessionStorage.getItem(SESSIONKEY_STATE);
	}
	static set state(value) {
		return StorageUtils.write(SESSIONKEY_STATE, value);
	}
	static get expiration() {
		return sessionStorage.getItem(SESSIONKEY_EXPIRATION);
	}
	static set expiration(value) {
		StorageUtils.write(SESSIONKEY_EXPIRATION, value);
	}
	static get info() {
		return StorageUtils.read(SESSIONKEY_INFO, true, {});
	}
	static set info(value) {
		StorageUtils.write(SESSIONKEY_INFO, value);
	}
	static get subjetUrl() {
		return sessionStorage.getItem(SESSIONKEY_URL);
	}
	static set subjetUrl(value) {
		StorageUtils.write(SESSIONKEY_URL, value);
	}
}
