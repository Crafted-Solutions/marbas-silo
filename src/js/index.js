import "../scss/index.scss";
import { EVENT_INITIALIZED, EVENT_NODE_SELECTED } from "@jbtronics/bs-treeview";

import { AuthModule } from "AuthModule";
import { MarBasDefaults } from "../conf/marbas.conf";
import { GrainEditor } from "./GrainEditor";
import { SiloNavi } from "./SiloNavi";
import { DataBrokerAPI } from "./DataBrokerAPI";
import { IconMaps } from "../conf/icons.conf";
import { LangSelector } from "./LangSelector";
import { Task, TaskLayer } from "./Task";
import { MsgBox } from "./MsgBox";

global.NoOp = () => {};

const taskLayer = new TaskLayer((evt) => {
	if (!evt.defaultPrevented) {
		MsgBox.invokeErr(`Unexpected error occured in task "${evt.detail.task.name}": ${evt.detail.payload}`);
	}
});

document.addEventListener(Task.Event.ERROR, (evt) => {
	if (!evt.defaultPrevented) {
		MsgBox.invokeErr(`Unexpected error occured in task "${evt.detail.task.name}": ${evt.detail.payload}`);
	}
});

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

const loadLoggedInState = () => {
	Task.now("Initializing", (done) => {
		naviMgr.tree.expandAll();
		processParameters();
		done();	
	}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
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
		loadLoggedInState();
	}
});
naviMgr.addEventListener(EVENT_NODE_SELECTED, (event) => {
	const node = event.detail.node || event.detail.data;
	Task.now("Loading grain editor", (done, error) => {
		apiSvc.getGrain((node.dataAttr || {}).grain)
		.then((grain) => {
			editorMgr.buildEditor(grain)
			.then(done)
			.catch(error);
		})
		.catch(error);
	}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
});

editorMgr.addChangeListener((grain) => {
	naviMgr.updateNode(grain);
});

authModule.addEventListener('silo-auth:login', () => {
	langSelector.populate();
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

langSelector.addChangeListener(() => {
	apiSvc.language = LangSelector.activeLang;
	editorMgr.resetEditor();
});
