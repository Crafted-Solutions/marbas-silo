import { SiloEvents, SiloEventUtils } from "./SiloEvents";

export const SiloEvtNavigate = {
	trigger: function trigger(grainId) {
		document.dispatchEvent(new CustomEvent(SiloEvents.NAVIGATE, { detail: grainId }));
	},
	on: function on(listener, useAsync = true) {
		document.addEventListener(SiloEvents.NAVIGATE, SiloEventUtils.makeCallback(listener, useAsync));
	}
};
