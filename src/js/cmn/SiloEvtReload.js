import { SiloEvents, SiloEventUtils } from "./SiloEvents";

export const SiloEvtReload = {
	trigger: function trigger(grainId, navigate = false) {
		const detail = { navigate: navigate };
		if (grainId) {
			detail.id = grainId;
		}
		document.dispatchEvent(new CustomEvent(SiloEvents.RELOAD, { detail: detail }));
	},
	on: function on(listener, useAsync = true) {
		document.addEventListener(SiloEvents.RELOAD, SiloEventUtils.makeCallbackWithArgs(listener, useAsync, ['id', 'navigate']));
	}
};
