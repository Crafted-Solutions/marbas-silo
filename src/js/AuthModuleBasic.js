import { MarBasDefaults } from "../conf/marbas.conf";

const SESSIONKEY_TOKEN = 'mbSiloToken';
const SESSIONKEY_URL = 'mbSiloBrokeUrl';
const SESSIONKEY_INFO = 'mbSiloInfo';

export class AuthModule {
	#element;

	constructor(element) {
		this.#element = document.getElementById(element);
		this.#element.querySelector('#silo-auth-btn-login').onclick = () => {
			return this.#validateAndLogin();
		};
		document.querySelector('#silo-auth-btn-logout').onclick = () => {
			return this.logout();
		};
		if (this.isLoggedIn) {
			this.#updateUI();
			this.#triggerEvent('silo-auth:login');	
		}
	}

	addEventListener(evtType, listener) {
		this.#element.addEventListener(evtType, listener);
	}

	get authType() {
		return 'Basic';
	}

	get authToken() {
		return sessionStorage.getItem(SESSIONKEY_TOKEN);
	}

	get brokerUrl() {
		return sessionStorage.getItem(SESSIONKEY_URL) || EnvConfig.apiBaseUrl;
	}

	get isLoggedIn() {
		return !!this.authToken && !!this.brokerUrl;
	}

	logout() {
		if (!this.#triggerEvent('silo-auth:beforelogout', true)) {
			return false;
		}
		this.#clearStorage();
		this.#element.querySelector('#silo-auth-txt-user').value = '';
		this.#element.querySelector('#silo-auth-txt-pwd').value = '';

		document.querySelectorAll('.silo-auth').forEach(x => x.classList.toggle('d-none', true));
		document.querySelectorAll('.silo-noauth').forEach(x => x.classList.toggle('d-none', false));
		this.#triggerEvent('silo-auth:logout');
	}

	get #sessionInfo() {
		const info = sessionStorage.getItem(SESSIONKEY_INFO);
		return info ? JSON.parse(info) : {};
	}

	#validateAndLogin() {
		this.#clearStorage();
		this.#element.querySelector('#silo-auth-validation').classList.toggle('is-invalid', false);

		const form = this.#element.querySelector('form');
		form.classList.toggle('was-validated', true);
		if (!form.checkValidity()) {
			this.#triggerEvent('silo-auth:failure');
			return false;
		}

		const user = this.#element.querySelector('#silo-auth-txt-user');
		const pw = this.#element.querySelector('#silo-auth-txt-pwd');
		const token = btoa(`${user.value}:${pw.value}`);
		const url = this.#element.querySelector('#silo-auth-txt-url').value;

		fetch(`${url}/SysInfo`, {
			withCredentials: true,
			credentials: 'include',
			headers: {
				Authorization: `${this.authType} ${token}`
			}
		})
		.then(res => {
			if (res.ok) {
				return res.json();
			}
			this.#reportError("Invalid user or password", `Request failed (${res.status} ${res.statusText})`);
			this.#triggerEvent('silo-auth:failure');
			return null;
		})
		.then(json => {
			if (json) {
				if (0 < MarBasDefaults.MinSchemaVersion.localeCompare(json.schemaVersion, undefined, {numeric: true, sensitivity: 'base'})) {
					this.#reportError(`Incompatible schema version: ${json.schemaVersion} (${MarBasDefaults.MinSchemaVersion} is expected)`);
					return;
				}
				if (0 < MarBasDefaults.MinAPIVersion.localeCompare(json.version, undefined, {numeric: true, sensitivity: 'base'})) {
					this.#reportError(`Incompatible API version: ${json.version} (${MarBasDefaults.MinAPIVersion} is expected)`);
					return;
				}
				this.#writeStorage(token, url, user.value, json);
				this.#updateUI();

				user.value = '';
				pw.value = '';
				this.#triggerEvent('silo-auth:login');	
			}
		})
		.catch(error => {
			this.#reportError("Error occured", error);
		});

		return true;
	}

	#writeStorage(token, url, user, sysinfo) {
		sessionStorage.setItem(SESSIONKEY_TOKEN, token);
		sessionStorage.setItem(SESSIONKEY_URL, url);
		sessionStorage.setItem(SESSIONKEY_INFO, JSON.stringify({user: user, brokerName: sysinfo.name, brokerVersion: sysinfo.version}));
	}

	#clearStorage() {
		sessionStorage.removeItem(SESSIONKEY_TOKEN);
		sessionStorage.removeItem(SESSIONKEY_URL);
		sessionStorage.removeItem(SESSIONKEY_INFO);
	}

	#reportError(text, logmsg) {
		if (logmsg) {
			console.error(logmsg);
		}
		this.#element.querySelector('#silo-auth-validation-fb').textContent = text;
		this.#element.querySelector('#silo-auth-validation').classList.toggle('is-invalid', true);
		this.#triggerEvent('silo-auth:failure');
	}

	#updateUI() {
		const info = this.#sessionInfo;
		document.getElementById('silo-auth-info-system').textContent = `${info.brokerName} ${info.brokerVersion}`;
		document.getElementById('silo-auth-info-user').textContent = info.user;

		document.querySelectorAll('.silo-auth').forEach(x => x.classList.toggle('d-none', false));
		document.querySelectorAll('.silo-noauth').forEach(x => x.classList.toggle('d-none', true));
	}

	#triggerEvent(evtType, cancelable = false) {
		const event = new CustomEvent(evtType, {
			bubbles: true,
			cancelable: cancelable
		});
		return this.#element.dispatchEvent(event);
	}
}