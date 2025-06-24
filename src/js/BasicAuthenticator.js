import dlgHtml from "../partials/LoginDialog.hbs";

import { AuthStorage } from "./AuthStorage";
import { _Dialog } from "./cmn/_Dialog";

class LoginDialog extends _Dialog {
	show(options) {
		if (options && options.brokerUrl) {
			this._element.querySelector(`#${this._scope}-subtitle`).textContent = options.brokerUrl;
		}
		super.show();
	}

	get user() {
		return this._element.querySelector(`#${this._scope}-txt-user`).value;
	}

	get pwd() {
		return this._element.querySelector(`#${this._scope}-txt-pwd`).value;
	}
}

export class BasicAuthenticator {
	#module;
	#dialog;

	constructor(authModule) {
		this.#module = authModule;
		this.#buildUI();
	}

	get authType() {
		return 'Basic';
	}

	get token() {
		return AuthStorage.accessToken;
	}

	async authorize() {
		this.#dialog.show({
			brokerUrl: this.#module.brokerUrl
		});
	}

	async processState() {
		return Promise.resolve();
	}

	async refresh() {
		return Promise.resolve(true);
	}

	async logout() {
		this.clearStorage();
		return Promise.resolve(false);
	}

	clearStorage() {
		AuthStorage.accessToken = null;
	}

	#buildUI() {
		if (!this.#dialog) {
			const tpl = document.createElement('template');
			tpl.innerHTML = dlgHtml({});
			document.body.appendChild(tpl.content);

			this.#dialog = new LoginDialog('login-dlg');
			this.#dialog.addEventListener('hidden.bs.modal', () => {
				if (this.#dialog.accepted) {
					const token = btoa(`${this.#dialog.user}:${this.#dialog.pwd}`);
					AuthStorage.accessToken = token;
					this.#module.loginComplete(this.#dialog.user);
				}
			});
		}
	}
}
export const Authenticator = BasicAuthenticator;