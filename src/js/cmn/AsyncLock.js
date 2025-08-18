export class AsyncLock {
	constructor() {
		this._resolver = () => { }
		this._rejecter = () => { }
		this.promise = Promise.resolve();
	}

	acquire(timeout = 0) {
		this.promise = new Promise((resolve, reject) => {
			this._resolver = resolve;
			this._rejecter = reject;
		});
		if (timeout) {
			this._timeout = setTimeout(() => {
				this.release(false);
			}, timeout);
		}
	}

	release(success = true) {
		if (this._timeout) {
			clearTimeout(this._timeout);
			delete this._timeout;
		}
		this[success ? '_resolver' : '_rejecter']();
	}

	async critSect(func) {
		await this.promise;
		this.acquire();
		try {
			return await func();
		} catch (e) {
			throw e;
		} finally {
			this.release();
		}
	}
}