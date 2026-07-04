export const SiloEvents = {
	NAVIGATE: 'mb-silo:navigate',
	RELOAD: 'mb-silo:reload',
	GRAIN_MODIFIED: 'mb-silo:grain-modified',
	GRAIN_DELETED: 'mb-silo:grain-deleted',
	GRAIN_RENAMED: 'mb-silo:grain-renamed',
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
	}
};
