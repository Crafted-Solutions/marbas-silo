import { SiloEvents, SiloEventUtils } from "./SiloEvents";

export const SiloEvtNavigate = {
	trigger: function trigger(grainId, expand = false) {
		document.dispatchEvent(new CustomEvent(SiloEvents.NAVIGATE, { detail: { id: grainId, expand: expand } }));
	},
	on: function on(listener, useAsync = true) {
		document.addEventListener(SiloEvents.NAVIGATE, SiloEventUtils.makeCallbackWithArgs(listener, useAsync, ['id', 'expand']));
	}
};
