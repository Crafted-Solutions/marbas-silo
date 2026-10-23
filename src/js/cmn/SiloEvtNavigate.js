import { SiloEvents, SiloEventUtils } from "./SiloEvents";

const EVENT_TYPE = SiloEvents.NAVIGATE;
export const SiloEvtNavigate = {
	trigger: function trigger(grainId, expand = false) {
		SiloEventUtils.dispatch(EVENT_TYPE, { id: grainId, expand: expand });
	},
	on: function on(listener, useAsync = true) {
		SiloEventUtils.addListener(EVENT_TYPE, listener, useAsync, ['id', 'expand']);
	}
};
