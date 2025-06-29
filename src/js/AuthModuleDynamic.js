import { AbstractAuthModule } from "./AbstractAuthModule";
import { AuthStorage } from "./AuthStorage.js";
import { MbDomUtils } from "./cmn/MbDomUtils.js";

export class AuthModule extends AbstractAuthModule {
	#helper;

	constructor(element) {
		super(element);
		this._init();
	}

	async authorizeRequest(request) {
		let result = request;
		let isLoggedIn = this.isLoggedIn;
		if (isLoggedIn) {
			isLoggedIn = await this.#verifyLogin();
			if (isLoggedIn) {
				await this.#configure();
				result = result || {};
				if (!result.headers) {
					result.headers = {};
				}
				result.headers.Authorization = `${this.#helper.authType} ${AuthStorage.accessToken}`;
			}
		}
		if (!isLoggedIn) {
			this._validateAndLogin();
		}
		return result;
	}

	async logout() {
		if (!this._triggerEvent('silo-auth:beforelogout', true)) {
			return false;
		}
		await this.#configure();
		await this.#helper.logout();
		this._clearStorage();
		this._updateUI();
		this._triggerEvent('silo-auth:logout');
	}

	async _validateAndLogin() {
		if (!this._validateForm()) {
			return false;
		}
		await this.#configure();
		this._clearStorage();
		await this.#helper.authorize();
	}

	_clearStorage() {
		super._clearStorage();
		if (this.#helper) {
			this.#helper.clearStorage();
		}
	}

	async _init() {
		if (!this.isLoggedIn && AuthStorage.state) {
			await this.#configure();
			if (this.#helper) {
				await this.#helper.processState();
				return;
			}
		} else {
			this.#showForm();
		}
		await super._init();
	}

	reportError(error, fatal = false) {
		super.reportError(error, fatal);
		if (fatal) {
			this.#showForm();
		}
	}

	async #configure() {
		if (!this._config) {
			this.#helper = null;
			this._config = await fetch(`${this.brokerUrl}/SysInfo/AuthConfig`).then(res => res.json());
		}
		if (!this.#helper) {
			const helperPkg = 'OIDC' == this._config.schema
				? await import(/* webpackChunkName: "oauth" */ './OAuthAuthenticator.js')
				: await import(/* webpackChunkName: "basicauth" */ './BasicAuthenticator.js');
			this.#helper = new helperPkg.Authenticator(this);
		}
		// console.log("AuthModule", this._config, this.#helper);
		return this._config;
	}

	async #verifyLogin() {
		if (this.isExpired) {
			await this.#configure();
			return await this.#helper.refresh();
		}
		return true;
	}

	#showForm() {
		MbDomUtils.hideNode(this._element.querySelector('form'), false);
		MbDomUtils.hideNode(this._element.querySelector('#silo-loading'));
	}
}
