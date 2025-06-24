import * as oauth from 'oauth4webapi';
import * as jose from 'jose';
import { AuthStorage } from './AuthStorage';

export class OAuthAuthenticator {
	#module;
	#oauthMeta;

	constructor(authModule) {
		this.#module = authModule;
		this.#configure();
	}

	get authType() {
		return 'Bearer';
	}

	get token() {
		return this.#useIdTokenAsBearer() ? AuthStorage.idToken : AuthStorage.accessToken;
	}

	async authorize() {
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

		window.location.href = authUrl.href;
	}

	async processState() {
		try {
			const config = this.#module.config;
			const client = {
				client_id: config.clientId
			};
			const params = oauth.validateAuthResponse(this.#oauthMeta, client, new URLSearchParams(window.location.search), config.pkce ? oauth.skipStateCheck : AuthStorage.state);

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
			OAuthAuthenticator.cleanLocation();
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
			this.#module.reportError(e);
		}
		return false;
	}

	async logout() {
		let result = false;
		try {
			const config = this.#module.config;
			if (config.logoutUrl) {
				result = true;
				const url = new URL(config.logoutUrl);
				if (AuthStorage.idToken) {
					url.searchParams.set('id_token_hint', AuthStorage.idToken);
				}
				if (AuthStorage.loginHint) {
					url.searchParams.set('logout_hint', AuthStorage.loginHint);
				}
				url.searchParams.set('client_id', config.clientId);
				url.searchParams.set('post_logout_redirect_uri', this.redirecUrl.href);

				window.location.href = url.href;
			}
		} catch (e) {
			this.#module.reportError(e);
		} finally {
			this.clearStorage();
		}
		return Promise.resolve(result);
	}

	clearStorage() {
		['accessToken', 'refreshToken', 'idToken', 'expiration', 'state', 'loginHint'].forEach(key => {
			AuthStorage[key] = null;
		});
	}

	get redirecUrl() {
		const result = new URL(window.location.href);
		result.search = '';
		result.hash = '';
		return result;
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