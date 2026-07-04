import { SiloEvents, SiloEventUtils } from "./SiloEvents";

export const SiloEvtGrainRenamed = {
	triggerMod: function triggerMod(grainMod) {
		if (grainMod && grainMod.id && grainMod.name) {
			document.dispatchEvent(new CustomEvent(SiloEvents.GRAIN_RENAMED, {
				detail: grainMod
			}));
		}
	},
	trigger: function trigger(grainId, newName) {
		SiloEvtGrainRenamed.triggerMod({ id: grainId, name: newName });
	},
	on: function on(listener, useAsync = true) {
		document.addEventListener(SiloEvents.GRAIN_RENAMED, SiloEventUtils.makeCallbackWithArgs(listener, useAsync, ['id', 'name']));
	}
};