import { SiloEvents, SiloEventUtils } from "./SiloEvents";

const EVENT_TYPE = SiloEvents.TYPDEF_DEFAULTS;
export const SiloEvtTypeDefDefaults = {
	trigger: function trigger(typeDefId, defaultInstanceId = null) {
		if (typeDefId) {
			SiloEventUtils.dispatch(EVENT_TYPE, {
				typeDefId: typeDefId,
				defaultsId: defaultInstanceId
			});
		}
	},
	on: function on(listener, useAsync = true) {
		SiloEventUtils.addListener(EVENT_TYPE, listener, useAsync, ['typeDefId', 'defaultsId']);
	}
};