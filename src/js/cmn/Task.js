import { Offcanvas } from "bootstrap";
import { MbDomUtils } from "./MbDomUtils";

export class Task {
	static Event = {
		START: 'task:start',
		STATUS: 'task:status',
		ABORT: 'task:abort',
		DONE: 'task:done',
		ERROR: 'task:error'
	};

	static Flag = {
		REPORT_END: 0x1,
		REPORT_ERROR: 0x2,
		REPORT_ABORT: 0x4,
		REPORT_START: 0x8,
		REPORT_STATUS: 0x10,
		DEFAULT: 0x1 | 0x2 | 0x4
	};

	id;
	name;
	flags = 0;
	caption = null;
	#worker;
	#binds = {
		onDone: null,
		onError: null,
		onAbort: null,
		onStatus: null
	};
	#running = false;
	#complete = false;
	#error;

	static now(name, worker, flags = Task.Flag.DEFAULT, caption = null) {
		return (new Task(name, worker, flags, caption)).run();
	}

	static async nowAsync(name, worker, flags = Task.Flag.DEFAULT, caption = null) {
		return await (new Task(name, worker, flags, caption)).runAsync();
	}

	constructor(name, worker, flags = Task.Flag.DEFAULT, caption = null, runImmediately = false) {
		this.id = `t${parseInt(Math.ceil(Math.random() * Date.now()).toPrecision(16).toString().replace(".", ""))}`;
		this.flags = flags;
		this.#binds.onDone = this.#onDone.bind(this);
		this.#binds.onError = this.#onError.bind(this);
		this.#binds.onAbort = this.#onAbort.bind(this);
		this.#binds.onStatus = this.#onStatus.bind(this);
		this.#worker = 'function' == typeof (worker) ? {
			start: worker
		} : worker;
		this.name = name;
		this.caption = caption;
		if (runImmediately) {
			this.run();
		}
	}

	run() {
		if (this.#worker && this.#worker.start) {
			this.#onStart();
			try {
				const potentialPromise = this.#worker.start(this.#binds.onDone, this.#binds.onError, this.#binds.onAbort, this.#binds.onStatus);
				if (potentialPromise && 'function' == typeof potentialPromise.then) {
					potentialPromise.then(this.#binds.onDone).catch(this.#binds.onError);
				}
				return potentialPromise;
			} catch (e) {
				this.#onError(e);
			}
		}
	}

	async runAsync() {
		if (this.#worker && this.#worker.start) {
			this.#onStart();
			try {
				const result = await this.#worker.start(this.#binds.onDone, this.#binds.onError, this.#binds.onAbort, this.#binds.onStatus);
				if (this.#running && !this.#error) {
					this.#onDone(result);
				} else if (undefined == this.#worker.result) {
					this.#worker.result = result;
				}
				return result;
			} catch (e) {
				this.#onError(e);
			}
		}
	}

	abort() {
		if (this.canAbort) {
			const potentialPromise = this.#worker.abort(this.#binds.onAbort);
			if (potentialPromise && 'function' == typeof potentialPromise.then) {
				potentialPromise.then(this.#binds.onAbort).catch(this.#binds.onError);
			}
		}
	}

	async abortAsync() {
		if (this.canAbort) {
			const result = await this.#worker.abort(this.#binds.onAbort);
			if (this.#running && !this.#error) {
				this.#onAbort(result);
			}
			return result;
		}
	}

	get canAbort() {
		return this.#running && this.#worker && 'function' == typeof this.#worker.abort;
	}

	get result() {
		return this.#worker ? this.#worker.result : 0;
	}

	get isRunning() {
		return this.#running;
	}

	get isComplete() {
		return this.#complete;
	}

	get lastError() {
		return this.#error;
	}

	hasFlag(flag) {
		return flag == (flag & this.flags);
	}

	#onStart() {
		this.#complete = false;
		this.#running = true;
		this.#error = undefined;
		if (this.hasFlag(Task.Flag.REPORT_START)) {
			this.#notify(Task.Event.START);
		}
	}

	#onError(params) {
		this.#running = false;
		this.#error = params;
		if (this.hasFlag(Task.Flag.REPORT_ERROR)) {
			this.#notify(Task.Event.ERROR, params);
		}
	}

	#onDone(params) {
		this.#running = false;
		this.#complete = true;
		if (undefined == this.#worker.result) {
			this.#worker.result = params;
		}
		if (this.hasFlag(Task.Flag.REPORT_END)) {
			this.#notify(Task.Event.DONE, params);
		}
	}

	#onAbort(params) {
		this.#running = false;
		if (this.hasFlag(Task.Flag.REPORT_ABORT)) {
			this.#notify(Task.Event.ABORT, params);
		}
	}

	#onStatus(params) {
		if (this.hasFlag(Task.Flag.REPORT_STATUS)) {
			this.#notify(Task.Event.STATUS, params);
		}
	}

	#notify(evtType, params) {
		if (Task.Event.ERROR == evtType) {
			console.error(`Task ${this.id} (${this.name}) error:`, params);
		}
		document.dispatchEvent(new CustomEvent(evtType, {
			cancelable: true,
			bubbles: false,
			detail: {
				task: this,
				payload: params
			}
		}));
	}
}

export class TaskLayer {
	#scope;
	#element;
	#pendingShow;
	#pendingHide;
	#defaultHandler;
	#taskTpl;
	#taskCnt;
	#tasks = {};

	constructor(defaultErrorHandler = null, scope = 'task-layer') {
		this.#scope = scope;
		this.#defaultHandler = defaultErrorHandler;
		this.#element = document.getElementById(scope);
		this.#element.addEventListener('hide.bs.offcanvas', this.#onClose.bind(this));
		this.canvas = Offcanvas.getOrCreateInstance(this.#element);

		this.#taskCnt = this.#element.querySelector(`#${this.#scope}-tasks`);
		this.#taskTpl = this.#element.querySelector(`#${this.#scope}-tpl-task`).content.querySelector('div');

		document.addEventListener(Task.Event.START, (evt) => {
			if (this.#addTask(evt.detail.task)) {
				this.#finalizeEvent(evt);
			}
		});
		document.addEventListener(Task.Event.DONE, (evt) => {
			if (this.#completeTask(evt.detail.task)) {
				this.#finalizeEvent(evt);
			}
		});
		document.addEventListener(Task.Event.ERROR, (evt) => {
			if (this.#handleTaskError(evt.detail.task, evt.detail.payload)) {
				this.#finalizeEvent(evt);
			} else if ('function' == typeof this.#defaultHandler) {
				this.#defaultHandler(evt);
			}
		});
		document.addEventListener(Task.Event.ABORT, (evt) => {
			if (this.#handleTaskAbort(evt.detail.task, evt.detail.payload)) {
				this.#finalizeEvent(evt);
			}
		});
		document.addEventListener(Task.Event.STATUS, (evt) => {
			if (this.#handleTaskStatus(evt.detail.task, evt.detail.payload)) {
				this.#finalizeEvent(evt);
			}
		});
	}

	#addTask(task) {
		if (task.isComplete || !task.hasFlag(Task.Flag.REPORT_START | Task.Flag.REPORT_END)) {
			return false;
		}
		const show = 0 == Object.keys(this.#tasks).length;
		this.#tasks[task.id] = task;

		const elm = this.#element.querySelector(`#${task.id}`) || this.#taskTpl.cloneNode(true);
		elm.querySelector(`.${this.#scope}-text`).textContent = (task.caption || task.name);
		MbDomUtils.hideNode(elm.querySelector(`.${this.#scope}-indprogress`), false);
		if (task.canAbort) {
			const btn = elm.querySelector(`.${this.#scope}-abort`);
			btn.onclick = () => {
				this.#abortTask(task.id);
			};
			MbDomUtils.hideNode(btn, false);
		}

		if (elm.id == task.id) {
			MbDomUtils.hideNode(elm, false);
		} else {
			elm.id = task.id;
			this.#taskCnt.appendChild(elm);
		}

		if (show) {
			this.#triggerShow();
		}
		return true;
	}

	#cleanUpTasks() {
		for (const k in this.#tasks) {
			if (!this.#tasks.isRunning) {
				delete this.#tasks[k];
				const elm = this.#element.querySelector(`#${k}`);
				if (elm) {
					elm.parentElement.removeChild(elm);
				}
			}
		}
	}

	#completeTask(task) {
		if (this.#tasks[task.id]) {
			this.#showTaskMessage(task, 'success');
			setTimeout(() => {
				this.#taskCnt.querySelector(`#${task.id}`).remove();
			}, 2000);
			delete this.#tasks[task.id];
			if (0 == Object.keys(this.#tasks).length) {
				this.#triggerHide();
			}
			return true;
		}
		return false;
	}

	#abortTask(taskOrId) {
		const task = taskOrId.id ? taskOrId : this.#tasks[taskOrId];
		task.abort();
	}

	#handleTaskError(task, err) {
		if (this.#tasks[task.id]) {
			this.#showTaskMessage(task, 'error', err);
			return true;
		}
		return false;
	}

	#handleTaskAbort(task, msg) {
		if (this.#tasks[task.id]) {
			this.#showTaskMessage(task, 'aborted', msg);
			if (1 == this.#canClose) {
				this.#triggerHide();
			}
			return true;
		}
		return false;
	}

	#handleTaskStatus(task, status) {
		if (task.isRunning && this.#tasks[task.id]) {
			if ('string' == typeof status) {
				this.#element.querySelector(`#${task.id} .${this.#scope}-text`).textContent = `${(task.caption || task.name)}: ${status}`;
			}
			return true;
		}
		return false;
	}

	#showTaskMessage(task, type, msg = null) {
		MbDomUtils.hideNode(this.#element.querySelector(`#${task.id} .${this.#scope}-abort`));
		MbDomUtils.hideNode(this.#taskCnt.querySelector(`#${task.id} .${this.#scope}-indprogress`));

		const alert = this.#taskCnt.querySelector(`#${task.id} .${this.#scope}-${type}`);
		if (msg) {
			alert.querySelector('.mb-val').textContent = "" + msg;
		}
		MbDomUtils.hideNode(alert, false);
	}

	#onClose(evt) {
		const canClose = this.#canClose;
		let prevent = false;
		if (1 != canClose) {
			prevent = true;
		}
		if (2 == canClose && confirm("Abort all running tasks?")) {
			for (const id in this.#tasks) {
				this.#abortTask(id);
			}
		}
		if (prevent) {
			if (evt) {
				this.#finalizeEvent(evt);
			}
		} else {
			this.#cleanUpTasks();
		}
		return !prevent;
	}

	get #canClose() {
		for (const k in this.#tasks) {
			if (this.#tasks[k].canAbort) {
				return 2;
			}
			if (this.#tasks[k].isRunning) {
				return 0;
			}
		}
		return 1;
	}

	#triggerShow() {
		if (!this.#pendingShow) {
			this.#cancelHide();
			this.#pendingShow = setTimeout(() => {
				this.canvas.show();
				this.#pendingShow = undefined;
			}, 300);
		}
	}

	#cancelShow() {
		if (this.#pendingShow) {
			clearTimeout(this.#pendingShow);
			this.#pendingShow = undefined;
		}
		this.#cancelHide();
	}

	#triggerHide() {
		if (!this.#pendingHide) {
			this.#cancelShow();
			this.#pendingHide = setTimeout(() => {
				this.canvas.hide();
				this.#pendingHide = undefined;
			}, 500);
		}
	}

	#cancelHide() {
		if (this.#pendingHide) {
			clearTimeout(this.#pendingHide);
			this.#pendingHide = undefined;
		}
	}

	#finalizeEvent(evt) {
		evt.stopPropagation();
		evt.preventDefault = true;
		evt.returnValue = false;
	}
}