import { MarBasRoleEntitlement } from "@crafted.solutions/marbas-core";

export class SiloTools {
	#apiSvc;
	#element;
	#tools = {};

	constructor(scope, apiSvc) {
		this.#element = document.getElementById(scope);
		this.#apiSvc = apiSvc;
	}

	async update() {
		const commands = [this.#element.querySelector('#cmdPackageIn'), this.#element.querySelector('#cmdPackageOut')];
		const canImport = await this.#apiSvc.getCurrentRoleEntitlement(MarBasRoleEntitlement.ImportSchema);
		commands[0].disabled = !canImport;
		const canExport = await this.#apiSvc.getCurrentRoleEntitlement(MarBasRoleEntitlement.ExportSchema);
		commands[1].disabled = !canExport;
		if ((canImport || canExport) && !this.#tools.packager) {
			this.#tools.packager = new (await import(/* webpackChunkName: "tool-packager" */'./Packager.js')).Packager(this.#apiSvc);
			for (const cmd of commands) {
				cmd.addEventListener('click', () => {
					this.#tools.packager[cmd.id]();
				});
			}
		}
	}
}