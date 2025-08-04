import { MarBasDefaults } from '@crafted.solutions/marbas-core';
import { AuthStorage } from './AuthStorage';
import { MbDomUtils } from './cmn/MbDomUtils';
import { t } from 'ttag';

export class AbstractAuthModule {
	_element;
	_config;
	_loginButton;
	_logoutButton;

	constructor(element) {
		this._element = document.getElementById(element);
		this._loginButton = this._element.querySelector('#silo-auth-btn-login');
		this._loginButton.onclick = () => {
			return this._validateAndLogin();
		};
		this._logoutButton = document.querySelector('#silo-auth-btn-logout');
		this._logoutButton.onclick = () => {
			this.logout();
			return false;
		};
	}

	get loginButton() {
		return this._loginButton;
	}

	get logoutButton() {
		return this._logoutButton;
	}

	get form() {
		return this._element.querySelector('form');
	}

	addEventListener(evtType, listener) {
		this._element.addEventListener(evtType, listener);
	}

	get brokerUrl() {
		return AuthStorage.subjetUrl || this._urlInput || EnvConfig.apiBaseUrl;
	}

	get isLoggedIn() {
		return !!AuthStorage.accessToken && !!this.brokerUrl;
	}

	get isExpired() {
		const expiration = AuthStorage.expiration;
		return expiration && expiration * 1000 - Date.now() < 10000;
	}

	get config() {
		return this._config;
	}

	async loginComplete(user) {
		const info = await this._fetchSysInfo();
		if (!info || !this._validateBackend(info) || !(await this._checkUserRoles())) {
			return;
		}
		this._writeStorage(this._urlInput, user, info);
		this._updateUI();
		this._triggerEvent('silo-auth:login');
	}

	reportError(error, fatal = false) {
		if (error instanceof Error) {
			console.error(error);
		}
		if (fatal) {
			this._clearStorage();
		}
		this._triggerEvent('silo-auth:failure', false, error);
	}

	get _urlInput() {
		return this._element.querySelector('#silo-auth-txt-url').value;
	}

	async _init() {
		if (this.isLoggedIn) {
			this._updateUI();
			this._triggerEvent('silo-auth:login');
		}
	}

	_updateUI() {
		const loggedIn = this.isLoggedIn;
		if (loggedIn) {
			const info = { brokerName: '??', brokerVersion: '', ...AuthStorage.info };
			document.getElementById('silo-auth-info').textContent = t`Connected to ${info.brokerName} ${info.brokerVersion} as ${info.user}`;
		} else {
			document.getElementById('silo-auth-info').textContent = '';
		}
		document.querySelectorAll('.silo-auth').forEach(x => MbDomUtils.hideNode(x, !loggedIn));
		document.querySelectorAll('.silo-noauth').forEach(x => MbDomUtils.hideNode(x, loggedIn));
	}

	_validateForm() {
		const form = this.form;
		form.classList.toggle('was-validated', true);
		if (!form.checkValidity()) {
			this._triggerEvent('silo-auth:failure');
			return false;
		}
		return true;
	}

	async _fetchSysInfo() {
		try {
			const opts = await this.authorizeRequest({
				withCredentials: true,
				credentials: 'include'
			});
			return await fetch(`${this._urlInput}/SysInfo`, opts).then(async res => {
				if (res.ok) {
					return await res.json();
				}
				const err = new Error(404 == res.status ? t`Invalid URL` : t`Invalid user or password`);
				err.error_description = t`Request failed (${res.status} ${res.statusText})`;
				throw err;
			});
		} catch (e) {
			this.reportError(e, true);
		}
	}

	_validateBackend(info) {
		if (!info) {
			return false;
		}
		if (0 < MarBasDefaults.MinSchemaVersion.localeCompare(info.schemaVersion, undefined, { numeric: true, sensitivity: 'base' })) {
			this.reportError(t`Incompatible schema version: ${info.schemaVersion} (${MarBasDefaults.MinSchemaVersion} is expected)`);
			return false;
		}
		if (0 < MarBasDefaults.MinAPIVersion.localeCompare(info.version, undefined, { numeric: true, sensitivity: 'base' })) {
			this.reportError(t`Incompatible API version: ${info.version} (${MarBasDefaults.MinAPIVersion} is expected)`);
			return false;
		}
		return true;
	}

	async _checkUserRoles() {
		try {
			const opts = await this.authorizeRequest({
				withCredentials: true,
				credentials: 'include'
			});
			return await fetch(`${this._urlInput}/Role/Current`, opts).then(async res => {
				if (res.ok) {
					const resp = await res.json();
					if (resp.success && resp.yield && resp.yield.length) {
						return true;
					}
				}
				throw new Error(t`Invalid user or password`);
			});
		} catch (e) {
			this.reportError(e, true);
		}
		return false;
	}

	_writeStorage(url, user, sysinfo) {
		AuthStorage.subjetUrl = url;
		const info = {
			user: user
		};
		if (sysinfo) {
			info.brokerName = sysinfo.name;
			info.brokerVersion = sysinfo.version;
		}
		AuthStorage.info = info;
	}

	_clearStorage() {
		['url', 'info'].forEach((key) => {
			AuthStorage[key] = null;
		})
	}

	_triggerEvent(evtType, cancelable = false, payload = undefined) {
		const options = {
			bubbles: true,
			cancelable: cancelable
		};
		if (payload) {
			options.detail = payload;
		}
		const event = new CustomEvent(evtType, options);
		return this._element.dispatchEvent(event);
	}
}
