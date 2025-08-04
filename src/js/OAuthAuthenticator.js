import { t } from "ttag";
import * as oauth from 'oauth4webapi';
import * as jose from 'jose';
import { AuthStorage } from './AuthStorage';
import { AsyncLock } from './cmn/AsyncLock';

const WORKER_TARGET = 'silo-login';
const WORKER_ATTRS = 'width=800,height=640';

const useSameWindowForRedirects = false;

export class OAuthAuthenticator {
	#module;
	#oauthMeta;
	#loginGuard;

	constructor(authModule) {
		this.#module = authModule;
		this.#module.form.target = WORKER_TARGET;
		this.#configure();
		if (!useSameWindowForRedirects) {
			AuthStorage.state = null;
			this.#loginGuard = new AsyncLock();
			window.addEventListener('message', async (evt) => {
				this.#closeWorker();
				if (AuthStorage.state && evt.data.params) {
					try {
						await this.#processProviderCallback(new URLSearchParams(evt.data.params));
					} finally {
						this.#loginGuard.release();
					}
				}
			});
		}
	}

	get authType() {
		return 'Bearer';
	}

	get token() {
		return this.#useIdTokenAsBearer() ? AuthStorage.idToken : AuthStorage.accessToken;
	}

	async authorize() {
		try {
			await this.#loginGuard.promise;
		} catch (_) { }
		if (this.#module.isLoggedIn) {
			return;
		}
		this.#closeWorker();
		const config = this.#module.config;

		const authUrl = new URL(config.authorizationUrl);
		authUrl.searchParams.set('client_id', config.clientId);
		authUrl.searchParams.set('redirect_uri', this.redirecUrl.href);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('scope', `${Object.keys(config.scopes).filter(x => config.scopes[x]).join(config.scopeSeparator || ' ')}`);

		if (config.pkce) {
			AuthStorage.state = oauth.generateRandomCodeVerifier();
			const codeChallenge = await oauth.calculatePKCECodeChallenge(AuthStorage.state);
			authUrl.searchParams.set('code_challenge', codeChallenge);
			authUrl.searchParams.set('code_challenge_method', 'S256');
		} else {
			AuthStorage.state = oauth.generateRandomState();
			authUrl.searchParams.set('state', AuthStorage.state);
		}

		if (useSameWindowForRedirects) {
			window.location.href = authUrl.href;
		} else {
			this.#loginGuard.acquire(180000);
			this._worker = window.open(authUrl.href, WORKER_TARGET, WORKER_ATTRS);
			if (this.#isWorkerBlocked()) {
				AuthStorage.state = null;
				this.#loginGuard.release();
				throw new Error(t`Your browser is blocking popups, please allow them for ${window.location.protocol}//${window.location.host} and try again`);
			}
			this.#watchLoginWorker();
			try {
				await this.#loginGuard.promise;
			} catch (_) {
				AuthStorage.state = null;
				this.#closeWorker();
				throw new Error(t`Timeout attempting authorization`);
			}
		}
	}

	async processState() {
		if (useSameWindowForRedirects) {
			const result = this.#processProviderCallback(new URLSearchParams(window.location.search));
			OAuthAuthenticator.cleanLocation();
			return result;
		}
		return false;
	}

	async refresh() {
		if (!AuthStorage.refreshToken) {
			return false;
		}
		try {
			const config = this.#module.config;
			const client = {
				client_id: config.clientId
			};
			const resp = await oauth.refreshTokenGrantRequest(this.#oauthMeta, client, this.#clientAuth(config), AuthStorage.refreshToken, this.#getTokenRequestOptions(config));
			const result = await oauth.processRefreshTokenResponse(this.#oauthMeta, client, resp);

			const claims = this.#getTokenClaims(result);
			this.#storeResults(result, claims);

			return !!result[this.#useIdTokenAsBearer(config) ? 'id_token' : 'access_token'];

		} catch (e) {
			console.error(e);
		}
		return false;
	}

	async logout() {
		let result = false;
		try {
			const url = this.#getLogoutUrl();
			if (url) {
				result = useSameWindowForRedirects;
				if (useSameWindowForRedirects) {
					window.location.href = url.href;
				} else {
					this._worker = window.open(url.href, WORKER_TARGET, WORKER_ATTRS);
					this._logoutWatch = setTimeout(() => {
						this.#closeWorker();
					}, 5000);
				}
			}
		} catch (e) {
			this.#module.reportError(e);
		} finally {
			this.clearStorage();
		}
		return result;
	}

	clearStorage() {
		['accessToken', 'refreshToken', 'idToken', 'expiration', 'state', 'loginHint'].forEach(key => {
			AuthStorage[key] = null;
		});
	}

	updateUIState(isLoggedIn) {
		if (useSameWindowForRedirects) {
			return;
		}
		let reset = true;
		const logoutBtn = this.#module.logoutButton;
		if (isLoggedIn) {
			const url = this.#getLogoutUrl();
			if (url) {
				logoutBtn.href = url.href;
				logoutBtn.target = WORKER_TARGET;
				reset = false;
			}
		}
		if (reset) {
			logoutBtn.href = '#main';
			logoutBtn.target = '';
		}
	}

	get redirecUrl() {
		if (useSameWindowForRedirects) {
			const result = new URL(window.location.href);
			result.search = '';
			result.hash = '';
			return result;
		}
		return new URL('login.html', window.location.href);
	}

	async #processProviderCallback(cbParams) {
		try {
			const config = this.#module.config;
			const client = {
				client_id: config.clientId
			};
			const params = oauth.validateAuthResponse(this.#oauthMeta, client, cbParams, config.pkce ? oauth.skipStateCheck : AuthStorage.state);

			const resp = await oauth.authorizationCodeGrantRequest(this.#oauthMeta, client, this.#clientAuth(config), params, this.redirecUrl.href, config.pkce ? AuthStorage.state : oauth.nopkce, this.#getTokenRequestOptions(config));
			const result = await oauth.processAuthorizationCodeResponse(this.#oauthMeta, client, resp);

			const claims = this.#getTokenClaims(result);
			this.#storeResults(result, claims);

			this.#module.loginComplete(claims.name || claims.preferred_username || claims.sub);

			return !!result[this.#useIdTokenAsBearer(config) ? 'id_token' : 'access_token'];

		} catch (e) {
			this.#module.reportError(e, true);
		} finally {
			AuthStorage.state = null;
		}
		return false;
	}

	#getLogoutUrl(config) {
		if (!config) {
			config = config = this.#module.config;
		}
		if (config.logoutUrl) {
			const result = new URL(config.logoutUrl);
			if (AuthStorage.idToken) {
				result.searchParams.set('id_token_hint', AuthStorage.idToken);
			}
			if (AuthStorage.loginHint) {
				result.searchParams.set('logout_hint', AuthStorage.loginHint);
			}
			result.searchParams.set('client_id', config.clientId);
			result.searchParams.set('post_logout_redirect_uri', this.redirecUrl.href);
			return result;
		}
		return null;
	}

	#getTokenRequestOptions(config) {
		if (!config) {
			config = config = this.#module.config;
		}
		return {
			[oauth.allowInsecureRequests]: 'development' == EnvConfig.mode && config.tokenUrl.startsWith('http:')
		};
	}

	#useIdTokenAsBearer(config) {
		return 'id_token' == (config || this.#module.config).bearerTokenName;
	}

	#clientAuth(config) {
		if (!config) config = this.#module.config;
		return config.clientSecret ? oauth.ClientSecretPost(config.clientSecret) : (_as, client, body, _headers) => {
			body.set('client_id', client.client_id);
		};
	}

	#getTokenClaims(authResult) {
		let result = oauth.getValidatedIdTokenClaims(authResult);
		if ((!result || !result.name) && authResult.access_token) {
			result = jose.decodeJwt(authResult.access_token);
		}
		return result || {};
	}

	#storeResults(authResult, claims) {
		AuthStorage.accessToken = authResult.access_token;
		AuthStorage.refreshToken = authResult.refresh_token;
		AuthStorage.idToken = authResult.id_token;
		AuthStorage.loginHint = claims ? claims.login_hint : null;
		let expiration = 0;
		if (claims && claims.exp) {
			expiration = claims.exp;
		}
		if (!expiration && authResult && authResult.expires_in) {
			expiration = Math.ceil(Date.now() / 1000) + authModule.expires_in;
		}
		if (expiration) {
			AuthStorage.expiration = expiration;
		}
	}

	#configure() {
		if (!this.#oauthMeta) {
			const config = this.#module.config;
			this.#oauthMeta = {
				issuer: config.authority,
				authorization_endpoint: config.authorizationUrl,
				token_endpoint: config.useTokenProxy ? `${this.#module.brokerUrl}/OAuth/Token` : config.tokenUrl,
				scopes_supported: Object.keys(config.scopes)
			};
			if (config.pkce) {
				this.#oauthMeta.code_challenge_methods_supported = ['S256'];
			}
		}
		return this.#oauthMeta;
	}

	#isWorkerBlocked() {
		return !this._worker || typeof this._worker.outerHeight === "undefined" || parseInt(this._worker.outerHeight) < 10;
	}

	#closeWorker() {
		if (useSameWindowForRedirects) {
			return;
		}
		if (this._logoutWatch) {
			clearTimeout(this._logoutWatch);
			delete this._logoutWatch;
		}
		if (this._workerWatch) {
			clearInterval(this._workerWatch);
			delete this._workerWatch;
		}
		if (this._worker && !this._worker.closed) {
			this._worker.close();
			delete this._worker;
		}
	}

	#watchLoginWorker() {
		if (this._worker && !this._worker.closed) {
			const watch = this._workerWatch = setInterval(() => {
				let clear = false;
				if (this._worker && this._worker.closed) {
					console.warn("Login processor was closed unexpectedly");
					AuthStorage.state = null;
					this.#loginGuard.release();
					delete this._worker;
					clear = true;
				}
				if (clear || !this._worker) {
					clearInterval(watch);
					delete this._workerWatch;
				}
			}, 1000);
		}
	}

	static get #stripCbUrlParams() {
		const result = new URL(window.location.href);
		const prevSize = result.searchParams.size;
		if (prevSize) {
			result.searchParams.delete('code');
			result.searchParams.delete('state');
			result.searchParams.delete('session_state');
			result.searchParams.delete('error');
			result.searchParams.delete('error_description');
			result.searchParams.delete('iss');
		}
		result._mod = prevSize > result.searchParams.size;
		return result;
	}

	static cleanLocation() {
		const url = OAuthAuthenticator.#stripCbUrlParams;
		if (url._mod) {
			window.history.replaceState({}, document.title, url);
		}
	}
}

export const Authenticator = OAuthAuthenticator;