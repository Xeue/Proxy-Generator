const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	log: (callback) => ipcRenderer.on('log', callback),
	setParams: message => ipcRenderer.send('setParams', message),
	setGateway: message => ipcRenderer.send('setGateway', message),
	setSpigots: message => ipcRenderer.send('setSpigots', message),
	catagories: (callback) => ipcRenderer.on('catagories', callback),
	devices: (callback) => ipcRenderer.on('devices', callback),
	xml: (callback) => ipcRenderer.on('xml', callback),
	error: (callback) => ipcRenderer.on('error', callback)
});