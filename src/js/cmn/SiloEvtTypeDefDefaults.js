import { SiloEvents, SiloEventUtils } from "./SiloEvents";

export const SiloEvtTypeDefDefaults = {
	trigger: function trigger(typeDefId, defaultInstanceId = null) {
		if (typeDefId) {
			document.dispatchEvent(new CustomEvent(SiloEvents.TYPDEF_DEFAULTS, {
				detail: {
					typeDefId: typeDefId,
					defaultsId: defaultInstanceId
				}
			}));
		}
	},
	on: function on(listener, useAsync = true) {
		document.addEventListener(SiloEvents.TYPDEF_DEFAULTS, SiloEventUtils.makeCallbackWithArgs(listener, useAsync, ['typeDefId', 'defaultsId']));
	}
};