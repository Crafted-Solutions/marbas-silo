import "../scss/index.scss";
import { EVENT_INITIALIZED, EVENT_NODE_SELECTED } from "@jbtronics/bs-treeview";

import { AuthModule } from "AuthModule";
import { MarBasDefaults } from "../conf/marbas.conf";
import { GrainEditor } from "./GrainEditor";
import { SiloNavi } from "./SiloNavi";
import { DataBrokerAPI } from "./DataBrokerAPI";
import { IconMaps } from "../conf/icons.conf";
import { LangSelector } from "./LangSelector";

const processParameters = () => {
	if (window.location.search) {
		const params = new URLSearchParams(window.location.search);
		if (params.get('grain')) {
			window.history.replaceState({}, document.title, "/");
			const evt = new CustomEvent('mb-silo:navigate', {detail: params.get('grain')});
			document.dispatchEvent(evt);
		}
	}
};

const authModule = new AuthModule('silo-auth');
const apiSvc = new DataBrokerAPI(authModule, LangSelector.activeLang);

const langSelector = new LangSelector('silo-lang', apiSvc);
if (authModule.isLoggedIn) {
	langSelector.populate();
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
}]);
const editorMgr = new GrainEditor('grain-edit', apiSvc);

naviMgr.addEventListener(EVENT_INITIALIZED, () => {
	if (authModule.isLoggedIn) {
		naviMgr.tree.expandAll();
		processParameters();
	}
});
naviMgr.addEventListener(EVENT_NODE_SELECTED, async (event) => {
	const node = event.detail.node || event.detail.data;
	editorMgr.buildEditor(await apiSvc.getGrain((node.dataAttr || {}).grain));
});
editorMgr.addChangeListener((grain) => {
	naviMgr.updateNode(grain);
});

authModule.addEventListener('silo-auth:login', () => {
	langSelector.populate();
	naviMgr.tree.expandAll();
	processParameters();
});
authModule.addEventListener('silo-auth:logout', () => {
	editorMgr.unloadEditor();
	naviMgr.reset();
});
authModule.addEventListener('silo-auth:beforelogout', (evt) => {
	if (editorMgr.dirty) {
		evt.preventDefault();
		evt.returnValue = false;
		editorMgr.unloadEditor().then(() => {
			authModule.logout();
		});
	}
});

langSelector.addChangeListener(() => {
	apiSvc.language = LangSelector.activeLang;
	editorMgr.resetEditor();
});
