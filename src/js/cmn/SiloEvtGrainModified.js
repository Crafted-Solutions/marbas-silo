import { SiloEvents, SiloEventUtils } from "./SiloEvents";

export const SiloEvtGrainModified = {
	trigger: function trigger(grain) {
		if (grain) {
			document.dispatchEvent(new CustomEvent(SiloEvents.GRAIN_MODIFIED, { detail: grain }));
		}
	},
	on: function on(listener, useAsync = true) {
		document.addEventListener(SiloEvents.GRAIN_MODIFIED, SiloEventUtils.makeCallback(listener, useAsync));
	}
};
