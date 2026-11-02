export const SiloEvents = {
	NAVIGATE: 'mb-silo:navigate',
	RELOAD: 'mb-silo:reload',
	GRAIN_MODIFIED: 'mb-silo:grain-modified',
	GRAIN_DELETED: 'mb-silo:grain-deleted',
	GRAIN_RENAMED: 'mb-silo:grain-renamed',
	GRAIN_STORED: 'mb-silo:grain-stored',
	TYPDEF_DEFAULTS: 'mb-silo:typedef-defaults'
};
export const SiloEventUtils = {
	makeCallback: function makeCallback(listener, useAsync) {
		return useAsync
			? async (evt) => {
				await listener(evt.detail);
			}
			: (evt) => {
				listener(evt.detail);
			};
	},
	makeCallbackWithArgs: function makeCallbackWithArgs(listener, useAsync, argNames) {
		const unpack = (detail) => {
			const result = [];
			for (const k of argNames) {
				result.push(detail ? detail[k] : null);
			}
			return result;
		};
		return useAsync
			? async (evt) => {
				await listener(...unpack(evt.detail));
			}
			: (evt) => {
				listener(...unpack(evt.detail));
			};
	},
	dispatch: function dispatch(eventType, payload) {
		document.dispatchEvent(new CustomEvent(eventType, { detail: payload }));
	},
	addListener: function addListener(eventType, listener, useAsync, argNames = null) {
		document.addEventListener(eventType,
			argNames ? SiloEventUtils.makeCallbackWithArgs(listener, useAsync, argNames) : SiloEventUtils.makeCallback(listener, useAsync));
	}
};
