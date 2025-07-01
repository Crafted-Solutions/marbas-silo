window.opener.postMessage({
	type: 'login-complete',
	params: new URLSearchParams(window.location.search).toString()
});
document.querySelector('h1').textContent = "Processing authorization provider response...";
