document.addEventListener('DOMContentLoaded', () => {
	window.electronAPI.log((event, log) => doLog(log));

	window.electronAPI.error((event, message) => alert(message));

	window.electronAPI.catagories((event, catagories) => {
		const _categoryList = document.getElementById('categoryList');
		_categoryList.innerHTML = "";
		Object.keys(catagories).forEach(id => {
			_categoryList.insertAdjacentHTML('beforeend', `<div class="categoryOption card card-body" data-id=${id}>${catagories[id]}</div>`);
		})
		showSection('categoryCont');
	});

	window.electronAPI.devices((event, devices) => {
		const _spigotsList = document.getElementById('spigotsList');
		_spigotsList.innerHTML = "";
		Object.keys(devices).forEach(id => {
			_spigotsList.insertAdjacentHTML('beforeend', `<div class="spigotCont">${JSON.stringify(devices[id])}</div>`);
		})
		showSection('spigotsCont');
	});
	
	on('click', '#paramsSet', ()=>{
		const params = {
			TFCURL: document.getElementById('paramURL').value,
			TFCAPIString: document.getElementById('paramAPI').value,
			token: document.getElementById('paramToken').value
		}
		window.electronAPI.setParams(params);
	});

	on('click', '#showSelect', ()=>showTab('categorySelect'));
	on('click', '#showLogs', ()=>showTab('logs'));
	on('input', '#catagorySearch', _element=>{
		const __catagories = document.getElementsByClassName('categoryOption');
		for (const _catagory of __catagories) {
			if (!_catagory.innerHTML.includes(_element.value)) _catagory.classList.add('d-none');
			else _catagory.classList.remove('d-none');
		}
	})
	on('click', '#catagoryClear', ()=>{
		const __catagories = document.getElementsByClassName('categoryOption');
		for (const _catagory of __catagories) {
			_catagory.classList.remove('d-none');
		}
		document.getElementById('catagorySearch').value = "";
	})
	on('click', '.categoryOption', _element => {
		const __selected = document.getElementsByClassName('selectedCategory');
		for (const _selected of __selected) {
			_selected.classList.remove('selectedCategory');
		}
		_element.classList.add('selectedCategory');
	});

	on('click', '#categorySet', ()=>{
		const _selected = document.getElementsByClassName('selectedCategory')[0];
		window.electronAPI.setCategory(_selected.getAttribute('data-id'));
	})
});


/* GUI */


function showTab(tab = 'categorySelect') {
	const __tabs = document.getElementsByClassName('tab');
	for (const _tab of __tabs) {
		_tab.classList.add('d-none');
	}
	document.getElementById(tab).classList.remove('d-none');
}

function showSection(tab) {
	const __tabs = document.getElementsByClassName('section');
	for (const _tab of __tabs) {
		_tab.classList.add('d-none');
	}
	document.getElementById(tab).classList.remove('d-none');
}

function doLog(log) {
	const Logs = document.getElementById('logs');

	const cols = [31,32,33,34,35,36,37];
	const specials = [1,2];
	const reset = 0;
	let currentCul = 37;
	let currnetSpec = 1;

	let logArr = log.split('[');

	let output = '';

	for (let index = 0; index < logArr.length; index++) {
		const element = logArr[index];
		const num = parseInt(element.substr(0, element.indexOf('m')));
		const text = element.substring(element.indexOf('m') + 1);

		if (cols.includes(num)) {
			currentCul = num;
		} else if (specials.includes(num)) {
			currnetSpec = num;
		} else if (num == reset) {
			currentCul = 37;
			currnetSpec = 1;
		}

		const colour = getClass(currentCul);
		const special = getClass(currnetSpec);
		output += `<span class="${colour} ${special}">${text}</span>`;
	}

	const $log = `<div class='log'>${output}</div>`;
	Logs.innerHTML += $log;
}

function getClass(num) {
	let value;
	switch (num) {
	case 31:
		value = 'redLog';
		break;
	case 32:
		value = 'greenLog';
		break;
	case 33:
		value = 'yellowLog';
		break;
	case 34:
		value = 'blueLog';
		break;
	case 35:
		value = 'purpleLog';
		break;
	case 36:
		value = 'cyanLog';
		break;
	case 37:
		value = 'whiteLog';
		break;
	case 2:
		value = 'dimLog';
		break;
	case 1:
		value = 'brightLog';
		break;
	}
	return value;
}

/* Utility */

function on(eventNames, selectors, callback) {
	if (!Array.isArray(selectors)) selectors = [selectors];
	if (!Array.isArray(eventNames)) eventNames = [eventNames];
	selectors.forEach(selector => {
		eventNames.forEach(eventName => {
			if (selector.nodeType) {
				selector.addEventListener(eventName, event => {callback(event.target)});
			} else {
				document.addEventListener(eventName, event => {
					document.querySelectorAll(selector).forEach(node => {if (node == event.target) {
						callback(event.target);
					}});
				});
			};
		});
	});
};