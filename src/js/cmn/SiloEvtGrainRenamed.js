import { SiloEvents, SiloEventUtils } from "./SiloEvents";

const EVENT_TYPE = SiloEvents.GRAIN_RENAMED;
export const SiloEvtGrainRenamed = {
	triggerMod: function triggerMod(grainMod) {
		if (grainMod && grainMod.id && grainMod.name) {
			SiloEventUtils.dispatch(EVENT_TYPE, grainMod);
		}
	},
	trigger: function trigger(grainId, newName) {
		SiloEvtGrainRenamed.triggerMod({ id: grainId, name: newName });
	},
	on: function on(listener, useAsync = true) {
		SiloEventUtils.addListener(EVENT_TYPE, listener, useAsync, ['id', 'name']);
	}
};