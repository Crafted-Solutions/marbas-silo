import { SiloEvents, SiloEventUtils } from "./SiloEvents";

const EVENT_TYPE = SiloEvents.GRAIN_DELETED;
export const SiloEvtGrainDeleted = {
	trigger: function trigger(grainId) {
		if (grainId) {
			SiloEventUtils.dispatch(EVENT_TYPE, grainId);
		}
	},
	on: function on(listener, useAsync = true) {
		SiloEventUtils.addListener(EVENT_TYPE, listener, useAsync);
	}
};