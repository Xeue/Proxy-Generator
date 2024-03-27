//import {Logs as _Logs} from 'xeue-logs';
const _Logs = require('xeue-logs').Logs;
//import {promises as files} from 'fs';
const files = require('fs').promises;

const Logs = new _Logs(false, 'logs', './', 'A', {'template': '$CATAGORY$SEPERATOR $MESSAGE'});
const logLevel = ['A', 'INPUT', Logs.c];
let TFCURL, TFCAPIString, token;

Logs.printHeader('ProxyGen');

main();

async function doApi(endpoint, method = 'GET') {
    const url = `${TFCURL}/${TFCAPIString}/${endpoint}`;
    const requestOptions = { 
        method: method, 
        headers: {
            'Authorization': 'Bearer '+token
        }
    }
    const request = await fetch(url, requestOptions);
    const requestJson = await request.json();
    return requestJson;
}

async function getInputs() {
    Logs.log('TFC API URL', logLevel)
    const [URLPromise] = Logs.input('https://api.nepuk.tfclabs.com');
    TFCURL = await URLPromise;
    Logs.log('TFC API Version', logLevel)
    const [APIPromise] = Logs.input('v1/api');
    TFCAPIString = await APIPromise;
    Logs.log('TFC API Token', logLevel)
    const [tokenPromise] = Logs.input('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IiQxIiwiY29udGV4dCI6ImRyaXZlciIsImV4cCI6MTc0MjA4MDE0MiwiaWF0IjoxNzEwNTIyNTQyLCJpc3MiOiJCcm9hZGNhc3QgRHJpdmVyIEpXVCBHZW5lcmF0b3IifQ.PzOvaebsFJHBsrlzKj_f8KAmsZ8oAaL5tsvGHqimBMM');
    token = await tokenPromise;
}

async function main() {
    await getInputs();
    const devices = {};
    const catagoriesData = await doApi('categories');
    const catagories = {};
    catagoriesData.results.forEach(catagory => {
        catagories[catagory.id] = catagory.name;
    });
    Logs.log('Select Catagory:', logLevel)
    const selectedCatagory = await Logs.select(catagories, catagoriesData.results[0].id);
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
    await files.writeFile(`./Proxy ${catagories[selectedCatagory]}.xml`, output);
    process.exit();
}