/* eslint-disable no-unused-vars */
const files = require('fs').promises;
const path = require('path');
const _Logs = require('xeue-logs').Logs;
const {app, BrowserWindow, ipcMain} = require('electron');
const {version} = require('./package.json');
const electronEjs = require('electron-ejs');
const {MicaBrowserWindow, IS_WINDOWS_11} = require('mica-electron');

const background = IS_WINDOWS_11 ? 'micaActive' : 'bg-dark';

const __static = __dirname+'/static';


/* Globals */

let isQuiting = false;
let mainWindow = null;
const devEnv = app.isPackaged ? './' : './';
const __main = path.resolve(__dirname, devEnv);

const Logs = new _Logs(false, 'logs', './', 'A', {'template': '$CATAGORY$SEPERATOR $MESSAGE'});
const logLevel = ['A', 'INPUT', Logs.c];
let TFCURL, TFCAPIString, token;

/* Start App */

(async () => {
	await app.whenReady();
	await setUpApp();
	await createWindow();
    Logs.printHeader('ProxyGen');
})().catch(error => {
	console.log(error);
});

const ejs = new electronEjs({
	'static': __static,
	'background': background,
	'version': version
}, {});


/* Electron */


async function setUpApp() {
	ipcMain.on('window', (event, message) => {
		switch (message) {
		case 'exit':
			app.quit();
			break;
		case 'minimise':
			mainWindow.hide();
			break;
		default:
			break;
		}
	});

	ipcMain.on('setParams', async (event, message) => {
        Logs.debug('Setting connection parameters and getting catagories');
        TFCURL = message.TFCURL;
        TFCAPIString = message.TFCAPIString;
        token = message.token;
		const catagories = await getCatagories();
        if (catagories) mainWindow.webContents.send('catagories', catagories);
	})

    ipcMain.on('setCategory', async (event, message) => {
        Logs.debug('Catagory selected, getting spigots');
        const devices = await getSpigots(message);
        mainWindow.webContents.send('devices', devices);
    })

    ipcMain.on('setSpigots', async (event, message) => {
        Logs.debug('Got spiggots, building XML');
        const filePath = await buildXML(message.devices);
        mainWindow.webContents.send('xml', filePath);
    })

	app.on('before-quit', function () {
		isQuiting = true;
	});

	app.on('activate', async () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});

	Logs.on('logSend', message => {
		if (!isQuiting) mainWindow.webContents.send('log', message);
	});
}

async function createWindow() {
	const windowOptions = {
		width: 1440,
		height: 720,
		autoHideMenuBar: true,
		webPreferences: {
			contextIsolation: true,
			preload: path.resolve(__main, 'preload.js')
		},
		icon: path.join(__static, 'img/icon/icon.png'),
		show: false,
		frame: false,
		titleBarStyle: 'hidden',
		titleBarOverlay: {
			color: '#313d48',
			symbolColor: '#ffffff',
			height: 56
		}
	}
	
	if (IS_WINDOWS_11) {
        windowOptions.height = 1720;
		mainWindow = new MicaBrowserWindow(windowOptions);
		mainWindow.setDarkTheme();
		mainWindow.setMicaEffect();
	} else {
		mainWindow = new BrowserWindow(windowOptions);
	}

	if (!app.commandLine.hasSwitch('hidden')) {
		mainWindow.show();
        if (IS_WINDOWS_11) mainWindow.setSize(1440, 845);
        else mainWindow.setSize(1440, 720);
	} else {
		mainWindow.hide();
	}

	mainWindow.on('close', function (event) {
		Logs.warn("Exiting");
	});

	mainWindow.on('minimize', function (event) {
		Logs.info("Minimising");
	});

	mainWindow.loadURL(path.resolve(__main, 'views/app.ejs'));
}

function sendGUI(channel, message) {
	mainWindow.webContents.send(channel, message);
}

async function sleep(seconds) {
	await new Promise (resolve => setTimeout(resolve, 1000*seconds));
}

//main();

async function doApi(endpoint, method = 'GET') {
    const url = `${TFCURL}/${TFCAPIString}/${endpoint}`;
    const requestOptions = { 
        method: method, 
        headers: {
            'Authorization': 'Bearer '+token
        }
    }
    Logs.debug(`Connectiong to: ${url}`);
    try {
        const request = await fetch(url, requestOptions);
        const requestJson = await request.json();
        return requestJson;
    } catch (error) {
        Logs.error('Failed to do fetch, incorrect details?', error);
    }
}

async function getCatagories() {
    try {        
        const catagoriesData = await doApi('categories');
        const catagories = {};
        catagoriesData.results.forEach(category => {
            catagories[category.id] = category.name;
        });
        return catagories;
    } catch (error) {
        Logs.error('Failed to get catagories', error);
        mainWindow.webContents.send('error', 'Failed to connect to server, are the connection details correct?');
    }
}

async function getSpigots(selectedCatagory) {
    const devices = {};
    const tagsRequest = await doApi('categories/'+selectedCatagory+'/tags');
    const tags = tagsRequest.results.map(tag => tag.id);
    const tagsPromise = [];
    tags.forEach(tag => {
        tagsPromise.push(doApi('tags/'+tag));
    });
    const tagsData = await Promise.all(tagsPromise);
    const spigots = [];
    const tagsPromises = [];
    tagsData.forEach(tag => {
        const spigot = {};
        spigot.name = tag.name;
        tag._embedded.flows.forEach(async flow => {
            const flowPromise = doApi('flows/senders/'+flow.id);
            tagsPromises.push(flowPromise);
            const flowData = await flowPromise;
            spigot[flow.level] = flowData.multicast_sessions;
            spigot.number = flowData.number;
            spigot.device = flow._links.device.id;
        });
        spigots.push(spigot);
    });

    await Promise.all(tagsPromises);

    spigots.forEach(spigot => {
        const device = spigot.device.replace(/-/g, '');
        if (typeof devices[device] == 'undefined') devices[device] = {'id':spigot.device,'spigots':[]};
        delete spigot.device;
        devices[device].spigots[spigot.number-1] = spigot;
        devices[device].spigots.filter(spig => spig);
    })

    const devicesPromises = [];
    Object.keys(devices).forEach(async device => {
        const deviceRequest = doApi('devices/'+device);
        devicesPromises.push(deviceRequest);
        const deviceDetails = await deviceRequest;
        devices[device].name = deviceDetails.name;
        devices[device].redIP = deviceDetails.management_ip;
        devices[device].blueIP = deviceDetails.redundant_management_ip;
    })

    await Promise.all(devicesPromises);
    //Logs.object(devices);
    return devices;
}

async function buildXML(devices) {
    let output = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    Object.keys(devices).forEach(deviceKey => {
        const device = devices[deviceKey];
        const redIP = device.redIP || "";
        const blueIP = device.blueIP || "";
        output += `<Device guid="{${device.id}}" userName="${device.name}" typeName="IQUCP25_SDI" softVer="17.0d.124" firmVer="DBAA5EE7" ipAddressA="${device.redIP}" ipAddressB="${device.blueIP}" linkSpeedA="25000" linkSpeedB="25000" numSources="8" numDests="8">\n`;
        device.spigots.forEach((spigot, index) => {
            output += `    <Spigot idx="${index}" mode="Src" format="3G" stream="dual" switch="MBB" prior="HI" linked="0" numFlows_A="7" numFlows_B="7">
        <Flow_A idx="0">
            <Caps smpte2022_6="1"/>
            <Params mcastAddress="" srcAddress="" dstPort="0" srcPort="0" type="none"/>
        </Flow_A>
        <Flow_B idx="0">
            <Caps smpte2022_6="1"/>
            <Params mcastAddress="" srcAddress="" dstPort="0" srcPort="0" type="none"/>
        </Flow_B>
        <Flow_A idx="1">
            <Caps rfc_4175="1"/>
            <Params mcastAddress="${spigot.video?.primary_multicast_address || ""}" srcAddress="${redIP}" dstPort="50100" srcPort="50100" type="rfc_4175"/>
        </Flow_A>
        <Flow_B idx="1">
            <Caps rfc_4175="1"/>
            <Params mcastAddress="${spigot.video?.secondary_multicast_address || ""}" srcAddress="${blueIP}" dstPort="50100" srcPort="50100" type="rfc_4175"/>
        </Flow_B>
        <Flow_A idx="2">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="${spigot.audio1?.primary_multicast_address || ""}" srcAddress="${redIP}" dstPort="5004" srcPort="5004" type="audio_pcm"/>
        </Flow_A>
        <Flow_B idx="2">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="${spigot.audio1?.secondary_multicast_address || ""}" srcAddress="${blueIP}" dstPort="5004" srcPort="5004" type="audio_pcm"/>
        </Flow_B>
        <Flow_A idx="3">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="" srcAddress="" dstPort="0" srcPort="0" type="none"/>
        </Flow_A>
        <Flow_B idx="3">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="" srcAddress="" dstPort="0" srcPort="0" type="none"/>
        </Flow_B>
        <Flow_A idx="4">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="" srcAddress="" dstPort="0" srcPort="0" type="none"/>
        </Flow_A>
        <Flow_B idx="4">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="" srcAddress="" dstPort="0" srcPort="0" type="none"/>
        </Flow_B>
        <Flow_A idx="5">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="" srcAddress="" dstPort="0" srcPort="0" type="none"/>
        </Flow_A>
        <Flow_B idx="5">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="" srcAddress="" dstPort="0" srcPort="0" type="none"/>
        </Flow_B>
        <Flow_A idx="6">
            <Caps metadata="1"/>
            <Params mcastAddress="${spigot.meta?.primary_multicast_address || ""}" srcAddress="${redIP}" dstPort="0" srcPort="0" type="none"/>
        </Flow_A>
        <Flow_B idx="6">
            <Caps metadata="1"/>
            <Params mcastAddress="${spigot.meta?.secondary_multicast_address || ""}" srcAddress="${blueIP}" dstPort="0" srcPort="0" type="none"/>
        </Flow_B>
    </Spigot>\n`;
        })
        output += `</Device>\n`;
    })

    Logs.log(`Proxy file created as 'Proxy ${catagories[selectedCatagory]}.xml' in this folder`, logLevel);
    await files.writeFile(path.join(__main, `Proxy ${catagories[selectedCatagory]}.xml`), output);
    return path.join(__main, `Proxy ${catagories[selectedCatagory]}.xml`);
}