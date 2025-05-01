import "../scss/index.scss";
import { EVENT_INITIALIZED, EVENT_NODE_SELECTED } from "@jbtronics/bs-treeview";

import { AuthModule } from "AuthModule";
import { MarBasDefaults, DataBrokerAPI, MarBasTraitValueType } from "@crafted.solutions/marbas-core";
import { GrainEditor } from "./GrainEditor";
import { SiloNavi } from "./SiloNavi";
import { IconMaps } from "../conf/icons.conf";
import { LangManager } from "./LangManager";
import { Task, TaskLayer } from "./cmn/Task";
import { MsgBox } from "./cmn/MsgBox";
import { ExtensionLoader } from "./ExtensionLoader";

global.NoOp = () => { };

const taskLayer = new TaskLayer((evt) => {
	if (!evt.defaultPrevented) {
		MsgBox.invokeErr(`Unexpected error occured in task "${evt.detail.task.name}": ${evt.detail.payload}`);
	}
});

const processParameters = () => {
	if (window.location.search) {
		const params = new URLSearchParams(window.location.search);
		if (params.get('grain')) {
			window.history.replaceState({}, document.title, "/");
			const evt = new CustomEvent('mb-silo:navigate', { detail: params.get('grain') });
			document.dispatchEvent(evt);
		}
	}
};

const loadLoggedInState = () => {
	Task.now("Initializing", (done) => {
		naviMgr.tree.expandAll();
		processParameters();
		done();
	}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
};

const authModule = new AuthModule('silo-auth');
const apiSvc = new DataBrokerAPI(authModule, LangManager.activeLang);

const langManager = new LangManager('silo-lang', apiSvc);
if (authModule.isLoggedIn) {
	langManager.reload();
}

const naviMgr = new SiloNavi('silo-nav', apiSvc, [{
	text: "marbas",
	lazyLoad: true,
	icon: IconMaps.ById[MarBasDefaults.ID_ROOT],
	id: `n-${MarBasDefaults.ID_ROOT}`,
	dataAttr: {
		grain: MarBasDefaults.ID_ROOT
	},
	state: {
		expanded: false
	}
}], () => {
	if (authModule.isLoggedIn) {
		loadLoggedInState();
	}
});

await ExtensionLoader.installExtension('GlobalInit', {
	MarBasDefaults: MarBasDefaults,
	auth: authModule,
	api: apiSvc,
	languages: langManager,
	navi: naviMgr
})

const editorMgr = new GrainEditor('grain-edit', apiSvc);
await ExtensionLoader.installExtension('GrainEditor', {
	MarBasDefaults: MarBasDefaults,
	MarBasTraitValueType: MarBasTraitValueType,
	GrainEditor: GrainEditor,
	navi: naviMgr,
	instance: editorMgr
});

naviMgr.addEventListener(EVENT_NODE_SELECTED, (event) => {
	const grainReq = ((event.detail.node || event.detail.data).dataAttr || {}).grain;
	Task.now("Loading grain editor", (done, error) => {
		apiSvc.isGrainInstanceOf(grainReq, MarBasDefaults.ID_TYPE_LINK)
			.then(isLink => {
				const builder = (grain, link, hasErrors) => {
					editorMgr.buildEditor(grain, false, link)
						.then(hasErrors ? NoOp : done)
						.catch(error);
				};

				if (isLink) {
					apiSvc.resolveGrainLink(grainReq).then((grain) => {
						const linkId = grainReq.id || grainReq;
						builder(grain, linkId == grain.id ? undefined : linkId);
					}).catch(reason => {
						error(reason);
						apiSvc.getGrain(grainReq).then((resp) => {
							builder(resp, undefined, true);
						}).catch(error);
					});
				} else {
					apiSvc.getGrain(grainReq).then(builder).catch(error);
				}
			})
			.catch(error);
	}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
});

editorMgr.addChangeListener((grain) => {
	naviMgr.updateNode(grain);
});

authModule.addEventListener('silo-auth:login', () => {
	langManager.reload();
	loadLoggedInState();
});
authModule.addEventListener('silo-auth:logout', () => {
	apiSvc.invalidateCurrentRoles();
	editorMgr.unloadEditor();
	naviMgr.reset();
});
authModule.addEventListener('silo-auth:beforelogout', (evt) => {
	if (editorMgr.dirty) {
		evt.preventDefault();
		evt.returnValue = false;
		const doLogout = () => {
			authModule.logout();
		};
		editorMgr.unloadEditor().then(doLogout).catch(reason => {
			console.warn(reason);
			doLogout();
		});
	}
});

langManager.addChangeListener(() => {
	apiSvc.language = LangManager.activeLang;
	editorMgr.resetEditor();
});
