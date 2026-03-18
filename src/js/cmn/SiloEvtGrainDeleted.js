import { SiloEvents, SiloEventUtils } from "./SiloEvents";

export const SiloEvtGrainDeleted = {
	trigger: function trigger(grainId) {
		if (grainId) {
			document.dispatchEvent(new CustomEvent(SiloEvents.GRAIN_DELETED, {
				detail: grainId
			}));
		}
	},
	on: function on(listener, useAsync = true) {
		document.addEventListener(SiloEvents.GRAIN_DELETED, SiloEventUtils.makeCallback(listener, useAsync));
	}
};