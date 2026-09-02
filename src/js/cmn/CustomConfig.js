import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { TraitUtils } from "./TraitUtils";

export class CustomConfig {
	static #configContainer;
	static #instances = {};

	#grain;
	#apiSvc;
	#values;

	constructor(grain, apiSvc) {
		this.#grain = grain;
		this.#apiSvc = apiSvc;
	}

	get grain() {
		return this.#grain;
	}

	get name() {
		return this.#grain.name;
	}

	async getValue(key, defaultVal = null) {
		if (!this.#values) {
			if (!this.#grain) {
				return defaultVal;
			}
			await this.reload();
		}
		return key in this.#values ? this.#values[key] : defaultVal;
	}

	async getKeys() {
		if (!this.#values) {
			if (!this.#grain) {
				return [];
			}
			await this.reload();
		}
		return Object.keys(this.#values);
	}

	getSection(name) {
		return {
			get name() {
				return name;
			},
			getValue: async (key, defaultVal = null) => {
				return await this.getValue(`${name}/${key}`, defaultVal);
			},
			getKeys: async () => {
				return (await this.getKeys()).filter(k => k.startsWith(`${name}/`)).map(k => k.split('/')[1]);
			}
		};
	}

	async getSectionNames() {
		return (await this.getKeys()).reduce((accu, k) => {
			const name = k.split('/')[0];
			if (!accu.includes(name)) {
				accu.push(name);
			}
			return accu;
		}, []);
	}

	async reload() {
		this.#values = await this.#loadValues();
	}

	async #loadValues() {
		const traits = await this.#apiSvc.getGrainTraits(this.#grain, true);
		return TraitUtils.mapTraitValues(traits);
	}

	static get DEFAULT_NAME() { return 'SiloConfig'; }

	static async register(configName, apiSvc) {
		if (CustomConfig.#instances[configName]) {
			return await CustomConfig.#instances[configName];
		}
		if (!CustomConfig.#configContainer) {
			CustomConfig.#configContainer = await apiSvc.getGrain(MarBasDefaults.ID_CONFIG);
		}
		CustomConfig.#instances[configName] = new Promise((resolve, reject) => {
			apiSvc.getGrainByPath(`${CustomConfig.#configContainer.path}/${configName}`).then((grain) => {
				resolve(new CustomConfig(grain, apiSvc));
			}).catch(reject);
		});
		return await CustomConfig.#instances[configName];
	}
	static async get(configName) {
		if (CustomConfig.#instances[configName]) {
			return await CustomConfig.#instances[configName];
		}
		return null;
	}

	static unregister(configName) {
		delete CustomConfig.#instances[configName];
	}
}