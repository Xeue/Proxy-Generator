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
			const device = devices[id];
			let html = `<div class="spigotCont card">
	<div class="d-flex deviceInfo gap-4 card-header">
		<input type="checkbox" checked>
		<div class="">Name: <input class="deviceName form-control-sm form-control" value="${device.name}"></div>
		<div class="">Red IP: <input class="deviceRedIP form-control-sm form-control" value="${device.redIP}"></div>
		<div class="">Blue IP: <input class="deviceBlueIP form-control-sm form-control" value="${device.blueIP}"></div>
		<input type="checkbox" checked class="deviceShow">
	</div>
	<div class="card-body d-flex deviceSpigots flex-column gap-3">`;
			device.spigots.forEach(spigot => {
				html += `<div class="card deviceSpigot">
					<div class="d-flex gap-3 card-header spigotInfo" data-name="${spigot.name}" data-number="${spigot.number}">
						<input type="checkbox" checked>
						<div class="spigotName">Spigot ${spigot.number}: ${spigot.name}</div>
						<input type="checkbox" class="spigotShow">
					</div>
					<div class="card-body d-flex flex-column flows gap-1 flowCont">`
				for (const key in spigot) {
					if (['name', 'number'].includes(key)) continue;
					html += `<div class="align-items-center align-self-baseline d-flex flow gap-3">
						<input type="checkbox" checked>
						Type: <input class="form-control-sm form-control flowType" value="${key}">
						Red: <input class="form-control-sm form-control flowPrimary" value="${spigot[key].primary_multicast_address}">
						Blue: <input class="form-control-sm form-control flowSecondary" value="${spigot[key].secondary_multicast_address}">
					</div>`;
				}
				html += `</div>
				</div>`;
			})
			html += `</div></div>`;
			_spigotsList.insertAdjacentHTML('beforeend', html);
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
	on('click', '#showLogs', ()=>showTab('logsTab'));
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
	const _logs = document.getElementById('logs');
	const cols = [31,32,33,34,35,36,37];
	const specials = [1,2];
	const reset = 0;
	let currentCul = getClass(log.textColour);
	let currnetSpec = 1;
	let output = `<span class="logTimestamp">[${log.timeString}]</span><span class="logLevel ${getClass(log.levelColour)}">${log.level} </span><span class="${getClass(log.colour)} logCatagory">${log.catagory}${log.seperator} </span>`;
	let first = true;
	const logArr = log.message.split('\x1b[');
	logArr.forEach((element, index) => {
		const num = parseInt(element.substr(0, element.indexOf('m')));
		const text = index==0 ? element : element.substring(element.indexOf('m') + 1);
		if (cols.includes(num)) {
			currentCul = num;
		} else if (specials.includes(num)) {
			currnetSpec = num;
		} else if (num == reset) {
			currentCul = 37;
			currnetSpec = 1;
		}
		output += `<span class="${getClass(currentCul)} ${getClass(currnetSpec)}">${text}</span>`;
	})
	output += `<span class="purpleLog logLinenum"> ${log.lineNumString}</span>`;

	const _log = `<div class='log' data-level="${log.level}">${output}</div>`;
	_logs.innerHTML = _log + _logs.innerHTML;
	const maxLogs = 499;
	_logs.childElementCount
	if (_logs.childElementCount > maxLogs) {
		_logs.children[maxLogs+1].remove();
	}
}

function getClass(num) {
	if (typeof num == 'string') {
		num = parseInt(num.substring(num.indexOf('m')-2, num.indexOf('m')));
	}
	if (num == 31) return 'redLog';
	if (num == 32) return 'greenLog';
	if (num == 33) return 'yellowLog';
	if (num == 34) return 'blueLog';
	if (num == 35) return 'purpleLog';
	if (num == 36) return 'cyanLog';
	if (num == 37) return 'whiteLog';
	if (num == 2) return 'dimLog';
	if (num == 1) return 'brightLog';
	return 'whiteLog';
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