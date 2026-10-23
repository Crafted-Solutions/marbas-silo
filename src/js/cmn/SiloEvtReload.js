import { SiloEvents, SiloEventUtils } from "./SiloEvents";

const EVENT_TYPE = SiloEvents.RELOAD;
export const SiloEvtReload = {
	trigger: function trigger(grainId, navigate = false) {
		const detail = { navigate: navigate };
		if (grainId) {
			detail.id = grainId;
		}
		SiloEventUtils.dispatch(EVENT_TYPE, detail);
	},
	on: function on(listener, useAsync = true) {
		SiloEventUtils.addListener(EVENT_TYPE, listener, useAsync, ['id', 'navigate']);
	}
};
