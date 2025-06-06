import { AbstractAuthModule } from "./AbstractAuthModule";
import { AuthStorage } from "./AuthStorage";

export class AuthModule extends AbstractAuthModule {

	constructor(element) {
		super(element);
		this._config = {};
		this._init();
	}

	async authorizeRequest(request) {
		let result = request;
		if (this.isLoggedIn) {
			result = result || {};
			if (!result.headers) {
				result.headers = {};
			}
			result.headers.Authorization = `Basic ${AuthStorage.accessToken}`;
		} else {
			this._validateAndLogin();
		}
		return result;
	}

	async logout() {
		if (!this._triggerEvent('silo-auth:beforelogout', true)) {
			return false;
		}
		this._clearStorage();
		this._updateUI();
		this._triggerEvent('silo-auth:logout');
	}

	async _validateAndLogin() {
		this._element.querySelector('#silo-auth-validation').classList.toggle('is-invalid', false);
		if (!this._validateForm()) {
			return false;
		}
		this._clearStorage();

		const user = this._element.querySelector('#silo-auth-txt-user').value;
		const pw = this._element.querySelector('#silo-auth-txt-pwd').value;

		AuthStorage.accessToken = btoa(`${user}:${pw}`);

		this.loginComplete(user);
	}

	_clearStorage() {
		AuthStorage.accessToken = null;
		super._clearStorage();
	}
}
