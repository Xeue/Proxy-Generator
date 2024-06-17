/* eslint-disable no-unused-vars */
const files = require('fs').promises;
const writeFileSync = require('fs').writeFileSync;
const path = require('path');
const _Logs = require('xeue-logs').Logs;
const {app, BrowserWindow, ipcMain, shell} = require('electron');
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
let TFCURL, TFCAPIString, token, targetCatagory, allCatagories;


process.on('uncaughtException', error => {
	Logs.error('Uncaught error', error);
});


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
        allCatagories = catagories;
        if (catagories) mainWindow.webContents.send('catagories', catagories);
	})

    ipcMain.on('setCategory', async (event, message) => {
        Logs.debug('Catagory selected, getting spigots');
        targetCatagory = allCatagories[message];
        const devices = await getSpigots(message);
        mainWindow.webContents.send('devices', devices);
    })

    ipcMain.on('setSpigots', async (event, message) => {
        Logs.debug('Got spiggots, building XML');
        const [filePath, xml] = await buildXML(message.devices);
        mainWindow.webContents.send('xml', {'path': filePath, 'xml': xml});
    })

    ipcMain.on('openExplorer', (event, message) => {
        shell.showItemInFolder(message);
    })
    
    ipcMain.on('openFile', (event, message) => {
        shell.openPath(message);
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
		width: 1640,
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
        if (IS_WINDOWS_11) mainWindow.setSize(1640, 845);
        else mainWindow.setSize(1640, 720);
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
    Logs.debug(`Connecting to: ${url}`);
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
        devices[device].spigots[spigot.number] = spigot;
        devices[device].spigots.filter(Boolean);
    })

    const devicesPromises = [];
    Object.keys(devices).forEach(async device => {
        const deviceRequest = doApi('devices/'+device);
        devicesPromises.push(deviceRequest);
        const deviceDetails = await deviceRequest;
        devices[device].name = deviceDetails.name;
        devices[device].type = deviceDetails['_embedded'].device_type.name;
        devices[device].redIP = devices[device].type.includes('SNP') ? '10.100.41.'+deviceDetails.management_ip.split('.')[3] : deviceDetails.management_ip;
        devices[device].blueIP = devices[device].type.includes('SNP') ? '10.101.41.'+deviceDetails.management_ip.split('.')[3] : deviceDetails.redundant_management_ip;
    })

    await Promise.all(devicesPromises);
    return devices;
}

async function buildXML(devices) {
    let output = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    Object.keys(devices).forEach(deviceKey => {
        const device = devices[deviceKey];
        let redIP = "";
        let blueIP = "";
        const isSNP = device.name.includes('SNP');
        if (isSNP) {
            redIP = '10.100.41.'+device.redIP.split('.')[3];
            blueIP = '10.101.41.'+device.redIP.split('.')[3];
        } else {
            redIP = device.redIP;
            blueIP = device.blueIP;
        }
        const vidPort = isSNP ? 50000 : 50100;
        const audPort = isSNP ? 50000 : 5004;
        let uhdLinking = 0;
        output += `<Device guid="{${device.id}}" userName="MCR_${device.name}" typeName="${device.type}" softVer="17.0d.124" firmVer="DBAA5EE7" ipAddressA="${redIP}" ipAddressB="${blueIP}" linkSpeedA="25000" linkSpeedB="25000" numSources="${device.spigots.length}" numDests="0">\n`;
        device.spigots.forEach((spigot, index) => {
            if (spigot.UHD || uhdLinking > 0) {
                uhdLinking++
            }
            if (spigot.UHD) {
                uhdLinking = 1;
            }
            if (uhdLinking > 4) uhdLinking = 0;
            output += `    <Spigot idx="${index}" mode="Src" format="3G" stream="dual" switch="MBB" prior="HI" linked="${uhdLinking > 0 ? uhdLinking-1 : 0}" numFlows_A="7" numFlows_B="7">
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
            <Params mcastAddress="${spigot.video?.primary_multicast_address || ""}" srcAddress="${redIP}" dstPort="${vidPort}" srcPort="${vidPort}" type="rfc_4175"/>
        </Flow_A>
        <Flow_B idx="1">
            <Caps rfc_4175="1"/>
            <Params mcastAddress="${spigot.video?.secondary_multicast_address || ""}" srcAddress="${blueIP}" dstPort="${vidPort}" srcPort="${vidPort}" type="rfc_4175"/>
        </Flow_B>
        <Flow_A idx="2">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="${spigot.audio1?.primary_multicast_address || ""}" srcAddress="${redIP}" dstPort="${audPort}" srcPort="${audPort}" type="audio_pcm"/>
        </Flow_A>
        <Flow_B idx="2">
            <Caps audio_pcm="1"/>
            <Params mcastAddress="${spigot.audio1?.secondary_multicast_address || ""}" srcAddress="${blueIP}" dstPort="${audPort}" srcPort="${audPort}" type="audio_pcm"/>
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

    const __path = process.env.PORTABLE_EXECUTABLE_DIR || __main;
    Logs.log(`Writing to file in ${__path}`, logLevel);
    writeFileSync(path.join(__path, `Proxy ${targetCatagory}.xml`), output);
    Logs.log(`Proxy file created as 'Proxy ${targetCatagory}.xml' in ${__path}`, logLevel);
    return [path.join(__path, `Proxy ${targetCatagory}.xml`), output];
}