import { SiloEvents, SiloEventUtils } from "./SiloEvents";

const EVENT_TYPE = SiloEvents.GRAIN_STORED;
export const SiloEvtGrainStored = {
	trigger: function trigger(grain) {
		if (grain) {
			SiloEventUtils.dispatch(EVENT_TYPE, grain);
		}
	},
	on: function on(listener, useAsync = true) {
		SiloEventUtils.addListener(EVENT_TYPE, listener, useAsync);
	}
};
