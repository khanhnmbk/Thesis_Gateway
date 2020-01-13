var mqtt = require('mqtt');
var fs = require('fs');
var path = require('path');
var async = require('async');
var StateMachine = require('javascript-state-machine');
var s7 = require('./module/s7_module');
var opcua = require('./module/opcua_module');
var color = require('colors');
var moment = require('moment');
var alarm = require('./module/alarm_module');
// var mongoose = require('mongoose');
// var mongooseAlarm = require('./module/mongooseAlarm');

//mongoose.connect('mongodb://localhost:27017/Gateway', { useNewUrlParser: true });



//STATE MACHINE VARIABLES
let state = 0;
let preState = -1;
//let $deviceID = 'DHBK2019-2';
let $deviceID = 'OPCUA';
let deviceConfig = {};
let configFilePath = 'config/config.json';
let logFilePath = 'log/datalogging.json';
let isSubscribeConfig = false;
let s7Protocol = 'S7-connection';
let opcuaProtocol = 'OPCUA';
let plcObjects = { s7: [], opcua: [] };
let arrAlarm = [];
let loggingInterval;    //For debugging purpose
let runInterval;
let retainOption = { retain: true };

//MQTT VARIABLES
let mqttHost = '127.0.0.1';
let mqttPort = 1883;
// let mqttHost = '45.124.94.180';
// let mqttPort = 8883;
let trustedCA = fs.readFileSync('certificate/mqtt_ca.crt');
let mqttConfigTopic = '/' + $deviceID + '/config';
let mqttTagTopic = '/' + $deviceID + '/tags';
let mqttWriteTopic = '/' + $deviceID + '/write';
let mqttAlarmTopic = '/' + $deviceID + '/alarm';
let mqttResAlarmTopic = '/' + $deviceID + '/resAlarm';
let mqttResetTopic = '/' + $deviceID + '/reset';
let mqttStatusTopic = '/' + $deviceID + '/status';
let mqttReqAllVariableTopic = '/' + $deviceID + '/reqAllVariables';

let mqttOptions = {
    host: mqttHost,
    port: mqttPort,
    rejectUnauthorized: false,
    ca: trustedCA,
    //protocol: 'mqtts',
    will: {
        topic: mqttStatusTopic,
        payload: JSON.stringify({ deviceID: $deviceID, status: false, timestamp: moment().format('YYYY-MM-DD HH:mm:ss') }, null, 4),
        qos: 1,
        retain: true
    }
}

var loggingObject = JSON.parse(fs.readFileSync(logFilePath));



var fsm = new StateMachine({
    init: 'none',
    transitions: [
        { name: 'start', from: '*', to: 'ready' },
        { name: 'nextStep', from: 'ready', to: 'init' },
        { name: 'nextStep', from: 'init', to: 'run' },
        { name: 'reset', from: '*', to: 'reset' },
    ],
    methods: {
        onEnterReady: onEnterReadyFunction,
        onEnterInit: onEnterInitFunction,
        onEnterRun: onEnterRunFunction,
        onEnterReset: onEnterResetFunction
    }
})





//Get started: Connect to MQTT broker
let mqttClient = mqtt.connect(mqttOptions);


//fsm.nextStep(); //Ready -> Init

mqttClient.on('connect', function () {
    console.log('Connected to MQTT broker: '.green, mqttHost.green);

    //Publish to status topic
    mqttClient.publish(mqttStatusTopic, JSON.stringify({ deviceID: $deviceID, status: true, timestamp: moment().format('YYYY-MM-DD HH:mm:ss') }, null, 4), retainOption)

    mqttClient.on('message', function (topic, message) {
        if (topic == mqttResetTopic) {
            var rcvObject = JSON.parse(message.toString());
            if (rcvObject.CMD) {
                mqttClient.publish(mqttResetTopic, '', retainOption);
                fsm.reset();
            }

        }
    });

    fsm.start();    //None -> Ready

    //Subscribe reset topic
    mqttClient.subscribe(mqttResetTopic, null, function (err, granted) {
        if (err) console.log('Subscription topic failed: '.red, mqttResetTopic.red);
        else console.log('Subscription topic succeeded: '.green, mqttResetTopic.green);
    });
}); //MQTT on connect


//On ready function: Execute when entering ready state
function onEnterReadyFunction() {
    if (fs.existsSync(configFilePath)) {    //If config file existed
        setTimeout(function () { //Wait until the transition is completed
            fsm.nextStep();
        }, 5000);
    } else { //Config file not existed
        async.series([
            function (callback) {
                loggingInterval = setInterval(function () { console.log('State READY'.gray) }, 2000);
                console.log('State READY'.gray);
                callback();
            },
            function (callback) {
                mqttClient.on('message', function (topic, message) {
                    if (topic == mqttConfigTopic) {
                        deviceConfig = JSON.parse(message.toString());  
                        fs.writeFile(configFilePath, JSON.stringify(deviceConfig, null, 4), function (err) {
                            if (err) console.log('Cannot save config file: '.red, err.red);
                            else {
                                console.log('Saved config file succesfully'.green);
                                mqttClient.unsubscribe(mqttConfigTopic, function (err, packet) {
                                    if (err) console.log('Topic unsubscription failed: '.red, mqttConfigTopic.red);
                                    else console.log('Topic unsubscription succeeded: '.green, mqttConfigTopic.green);
                                });
                                clearInterval(loggingInterval);
                                setTimeout(function () {
                                    fsm.nextStep(); //Go to Init step
                                }, 3000);
                                //Clear retained config MQTT message
                                mqttClient.publish(mqttConfigTopic, '', retainOption);
                            }
                        })
                    }
                });

                mqttClient.subscribe(mqttConfigTopic, null, function (err, granted) {
                    if (err) console.log('Topic subscription failed: '.red, mqttConfigTopic.red);
                    else console.log('Topic subscription succeeded: '.green, mqttConfigTopic.green);
                    callback();
                });
            },
        ])
    }
}

//On init function: Execute when entering init state
function onEnterInitFunction() {
    deviceConfig = JSON.parse(fs.readFileSync(configFilePath));
    for (var i = 0; i < deviceConfig.PLCs.length; i++) {
        for (var j = 0; j < deviceConfig.PLCs[i].variables.length; j++) {
            deviceConfig.PLCs[i].variables[j].currentAlarmState = 'OK';
        }
    }
    deviceConfig.currentAlarmState = 'OK';
    string2Number();
    var plcIndex = 0;

    loggingInterval = setInterval(function () { console.log('State INIT'.gray) }, 2000);
    console.log('State INIT'.gray);

    async.whilst(
        function () {
            return plcIndex < deviceConfig.PLCs.length;
        },
        function (callback) {
            if (deviceConfig.PLCs[plcIndex].protocol == s7Protocol) {   //S7 Connection
                var s7Object = { plc: {}, variables: [], mqttTags: [] };
                s7.initConnection(deviceConfig.PLCs[plcIndex].name, deviceConfig.PLCs[plcIndex].ipAddress, 102, 0, 1, function (connectionResult) {
                    if (connectionResult) {
                        s7Object.plc = connectionResult;
                        for (var i = 0; i < deviceConfig.PLCs[plcIndex].variables.length; i++) {
                            s7Object.variables.push(s7.modifyAddress(deviceConfig.PLCs[plcIndex].variables[i].address, deviceConfig.PLCs[plcIndex].variables[i].dataType));
                            s7Object.mqttTags.push({
                                tagName: deviceConfig.PLCs[plcIndex].name + '_' + deviceConfig.PLCs[plcIndex].variables[i].name,
                                dataType: deviceConfig.PLCs[plcIndex].variables[i].dataType,
                                address: deviceConfig.PLCs[plcIndex].variables[i].address,
                                isHistory: deviceConfig.PLCs[plcIndex].variables[i].isHistory,
                                value: null,
                                timestamp: null
                            });
                        }
                        plcObjects.s7.push(s7Object);
                        s7.initReadingList(s7Object.plc.s7Node, s7Object.variables);
                    } else {
                        fsm.start();
                    }
                    plcIndex++;
                    callback();
                });
            } else {    //OPC UA
                var opcuaObject = { plc: {}, variables: [], mqttTags: [] };
                opcua.initConnection(deviceConfig.PLCs[plcIndex].name, deviceConfig.PLCs[plcIndex].ipAddress, function (connectionResult) {
                    if (connectionResult) {
                        opcuaObject.plc = connectionResult;
                        for (var i = 0; i < deviceConfig.PLCs[plcIndex].variables.length; i++) {
                            opcuaObject.variables.push(deviceConfig.PLCs[plcIndex].variables[i].address);
                            opcuaObject.mqttTags.push({
                                tagName: deviceConfig.PLCs[plcIndex].name + '_' + deviceConfig.PLCs[plcIndex].variables[i].name,
                                dataType: deviceConfig.PLCs[plcIndex].variables[i].dataType,
                                address: deviceConfig.PLCs[plcIndex].variables[i].address,
                                isHistory: deviceConfig.PLCs[plcIndex].variables[i].isHistory,
                                value: null,
                                timestamp: null
                            });
                        }
                        plcObjects.opcua.push(opcuaObject);
                    } else {
                        fsm.start();
                    }
                    plcIndex++;
                    callback();
                })
            }
        },
        function () {
            console.log('Finish configuring'.yellow);
            clearInterval(loggingInterval);
            fsm.nextStep();
        }
    )

}


//On run function: Execute when entering run state
//Subscribe the interval event to read data periodly
function onEnterRunFunction() {

    // console.log(plcObjects.s7[0].variables);
    // console.log(plcObjects.s7[0].mqttTags);

    //For debugging purpose
    loggingInterval = setInterval(function () { console.log('State RUN'.gray) }, 5000);
    console.log('State RUN'.gray);

    //Subscribe write topic
    mqttClient.subscribe(mqttWriteTopic, null, function (err, granted) {
        if (err) console.log('Topic subscription failed: '.red, mqttWriteTopic.red);
        else console.log('Topic subscription succeeded: '.green, mqttWriteTopic.green);
    });

    //Subscribe response alarm topic
    mqttClient.subscribe(mqttResAlarmTopic, null, function (err, granted) {
        if (err) console.log('Topic subscription failed: '.red, mqttResAlarmTopic.red);
        else console.log('Topic subscription succeeded: '.green, mqttResAlarmTopic.green);
    });

    //Clients request all variable when they first connect
    mqttClient.subscribe(mqttReqAllVariableTopic, null, function(err, granted){
        if (err) console.log('Topic subscription failed: '.red, mqttReqAllVariableTopic.red);
        else console.log('Topic subscription succeeded: '.green, mqttReqAllVariableTopic.green);
    })

    //Listen incoming messages
    mqttClient.on('message', function (topic, message) {
        //MQTT write topic
        if (topic == mqttWriteTopic) {
            var variableName = message.toString().replace(/\s/g, '').split('=')[0];
            var valueString = message.toString().replace(/\s/g, '').replace(variableName + '=', '');
            var valueNumber = Number(valueString);
            var value = isNaN(valueNumber) ? valueString : valueNumber;
            var varObj = getVariableInfo(variableName);
            if ((varObj != null)) {
                if (varObj.access == 'read') { //Only read
                    console.log('No write access');
                } else { //Read/write
                    if (varObj.protocol == s7Protocol) { //S7-connection
                        for (var i = 0; i < plcObjects.s7.length; i++) {
                            if (plcObjects.s7[i].plc.address == varObj.plcAddress) {
                                if (varObj.dataType == 'Bool') value = Boolean(value);
                                s7.writeData(plcObjects.s7[i].plc.s7Node, s7.modifyAddress(varObj.variableAddress, varObj.dataType), value);
                                break;
                            }
                        }
                    } else { //OPC UA
                        var plcIndex = 0;
                        async.whilst(
                            function () {
                                return plcIndex < plcObjects.opcua.length;
                            },
                            function (callback) {
                                if (plcObjects.opcua[plcIndex].plc.address == varObj.plcAddress) {
                                    opcua.writeData(plcObjects.opcua[plcIndex].plc.opcuaNode, varObj.variableAddress, varObj.dataType, value, function (result) {
                                        if (result) console.log('Set OPC UA data succeeded'.green);
                                        else console.log('Set OPC UA data failed'.red);
                                        break;
                                    })
                                } else {
                                    plcIndex++;
                                    callback();
                                }
                            }
                        )
                    }
                }
            }
        }
        //MQTT response alarm topic 
        else if (topic == mqttResAlarmTopic) {
            var resAlarmObject = JSON.parse(message.toString());
            console.log('Response alarm object'.cyan);
            console.log(resAlarmObject);
            var alarmIndex = 0;
            async.whilst(
                function () {
                    return alarmIndex < resAlarmObject.resAlarm.length;
                },
                function (callback) {
                    var newAlarm = resAlarmObject.resAlarm[alarmIndex];
                    if (newAlarm.type == 'ON' || newAlarm.type == 'OFF') newAlarm.value = (newAlarm.value == 'true');
                    else newAlarm.value = Number(newAlarm.value);
                    //newAlarm.deviceID = resAlarmObject.deviceID;                   
                    console.log('New alarm'.red);
                    console.log(newAlarm);

                    findAlarm(newAlarm.source, newAlarm.type, function (result) {
                        mqttClient.publish(mqttAlarmTopic, JSON.stringify(newAlarm, null, 4), retainOption);
                        if (result != -1) { //Update
                            // console.log('Response alarm mongo' .red);
                            // console.log(result);
                            arrAlarm[result].state = newAlarm.state;
                            arrAlarm[result].timestamp = newAlarm.timestamp;
                        }

                        alarmIndex++;
                        callback();
                    });
                }
            )

        } 
        //MQTT request all variable
        else if (topic == mqttReqAllVariableTopic) {
            console.log('Read All');
            readAllTags(true);
        }


    });

    //Set interval for periodly data read
    runInterval = setInterval(function () {
        async.series([
            function (callback) {
                readAllTags(false);
                callback();
            },
            function (callback) {
                alarmChecking();
                // console.log('ARRAY ALARM' .red);
                // console.log(arrAlarm);
                callback();
            }
        ])
    }, deviceConfig.period)
}

//On reset function: Execute when entering reset state
function onEnterResetFunction() {
    clearInterval(loggingInterval);
    clearInterval(runInterval);
    loggingInterval = setInterval(function () { console.log('State RESET'.gray) }, 2000);
    console.log('State RESET'.gray);
    if (fs.existsSync(configFilePath)) {
        fs.unlinkSync(configFilePath);
    };
    setTimeout(function () {
        clearInterval(loggingInterval);
        fsm.start();
    }, 3000);
}

//Convert config object string value to number
function string2Number() {
    deviceConfig.longitude = Number(deviceConfig.longitude);
    deviceConfig.latitude = Number(deviceConfig.latitude);
    deviceConfig.period = Number(deviceConfig.period);

    for (var i = 0; i < deviceConfig.PLCs.length; i++) {
        for (var j = 0; j < deviceConfig.PLCs[i].variables.length; j++) {
            deviceConfig.PLCs[i].variables[j].alarmType = Number(deviceConfig.PLCs[i].variables[j].alarmType);
            if (deviceConfig.PLCs[i].variables[j].alarmType == 1) {
                deviceConfig.PLCs[i].variables[j].parameters.lolo = Number(deviceConfig.PLCs[i].variables[j].parameters.lolo);
                deviceConfig.PLCs[i].variables[j].parameters.lo = Number(deviceConfig.PLCs[i].variables[j].parameters.lo);
                deviceConfig.PLCs[i].variables[j].parameters.hi = Number(deviceConfig.PLCs[i].variables[j].parameters.hi);
                deviceConfig.PLCs[i].variables[j].parameters.hihi = Number(deviceConfig.PLCs[i].variables[j].parameters.hihi);
                deviceConfig.PLCs[i].variables[j].parameters.deadband = Number(deviceConfig.PLCs[i].variables[j].parameters.deadband);
            }
        }
    }
}

//Read data 
function readAllTags(isReadAll) {
    var s7Index = 0;
    async.whilst(
        function () {
            return s7Index < plcObjects.s7.length;
        },
        function (callback) {
            s7.readAllData(plcObjects.s7[s7Index].plc.s7Node, function (data) {
                var oldArray = JSON.parse(JSON.stringify(plcObjects.s7[s7Index].mqttTags));
                console.log(data);
                var arrValue = Object.values(data);
                var arrKey = Object.keys(data);
                for (var i = 0; i < arrValue.length; i++) {
                    for (var j = 0; j < plcObjects.s7[s7Index].variables.length; j++) {
                        if (arrKey[i] == plcObjects.s7[s7Index].variables[j]) {
                            plcObjects.s7[s7Index].mqttTags[j].value = arrValue[i];
                            plcObjects.s7[s7Index].mqttTags[j].timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
                            break;
                        }
                    }
                }
                var diffArray = compareArrays(oldArray,plcObjects.s7[s7Index].mqttTags);
                //console.log(plcObjects.s7[s7Index].mqttTags);
                if (isReadAll) {
                        mqttClient.publish(mqttTagTopic, JSON.stringify({
                            deviceID: $deviceID,
                            variables: plcObjects.s7[s7Index].mqttTags
                        }, null, 4));
                } else {
                    if (diffArray.length > 0) {
                        mqttClient.publish(mqttTagTopic, JSON.stringify({
                            deviceID: $deviceID,
                            variables: diffArray
                        }, null, 4));
                    }
                }
                
                s7Index++;
                callback();
            })
        },
        function () {
            console.log('Finish reading S7 tags'.yellow);
        }
    );
    var opcuaIndex = 0;
    async.whilst(
        function () {
            return opcuaIndex < plcObjects.opcua.length;
        },
        function (callback) {
            opcua.readMultipleValue(plcObjects.opcua[opcuaIndex].plc.opcuaNode, plcObjects.opcua[opcuaIndex].variables, function (data) {
                var oldArray = JSON.parse(JSON.stringify(plcObjects.opcua[opcuaIndex].mqttTags));
                console.log(data);
                for (var i = 0; i < data.length; i++) {
                    plcObjects.opcua[opcuaIndex].mqttTags[i].value = data[i];
                    plcObjects.opcua[opcuaIndex].mqttTags[i].timestamp = moment().format('YYYY-MM-DD HH:mm:ss')
                }
                var diffArray = compareArrays(oldArray, plcObjects.opcua[opcuaIndex].mqttTags);
                //console.log(plcObjects.opcua[opcuaIndex].mqttTags);
                if (isReadAll) {
                    mqttClient.publish(mqttTagTopic, JSON.stringify({
                        deviceID: $deviceID,
                        variables: plcObjects.opcua[opcuaIndex].mqttTags
                    }, null, 4));
                } else {
                    if (diffArray.length > 0) {
                        mqttClient.publish(mqttTagTopic, JSON.stringify({
                            deviceID: $deviceID,
                            variables: diffArray
                        }, null, 4));
                    }
                }
                opcuaIndex++;
                callback();
            });
        },
        function () {
            console.log('Finish reading OPCUA tags'.yellow);
        }
    );
}

//Alarm checking
function alarmChecking() {
    var plcIndex = 0;
    async.whilst(
        function () {
            return plcIndex < deviceConfig.PLCs.length;
        },
        function (callback) {
            var variableIndex = 0;
            async.whilst(
                function () {
                    return variableIndex < deviceConfig.PLCs[plcIndex].variables.length;
                },
                function (callback1) {
                    var value;

                    if (deviceConfig.PLCs[plcIndex].protocol == s7Protocol) {
                        value = plcObjects.s7[plcIndex].mqttTags[variableIndex].value
                    } else {
                        value = plcObjects.opcua[plcIndex].mqttTags[variableIndex].value
                    }

                    if (deviceConfig.PLCs[plcIndex].variables[variableIndex].isAlarm) {
                        var returnAlarm = alarm.checkAlarm(deviceConfig.PLCs[plcIndex].variables[variableIndex], $deviceID, value);

                        // console.log('Current alarm object: ' .red);
                        // console.log(returnAlarm);

                        findAlarm(returnAlarm.source, null, function (result) {
                            if (result != -1) {   //Alarm existing
                                console.log('Found alarm'.cyan);
                                console.log(arrAlarm[result]);

                                if (returnAlarm.type == 'OK' || returnAlarm.type == 'OFF') {
                                    mqttClient.publish(mqttAlarmTopic, JSON.stringify(returnAlarm, null, 4), retainOption);
                                    arrAlarm.splice(result, 1);
                                } else {    //Not OK, update value
                                    if ((returnAlarm.type == arrAlarm[result].type) && (returnAlarm.value == arrAlarm[result].value)) {
                                        //Skip this alarm
                                    } else {
                                        mqttClient.publish(mqttAlarmTopic, JSON.stringify(returnAlarm, null, 4), retainOption);

                                        arrAlarm[result].value = returnAlarm.value;
                                        arrAlarm[result].message = returnAlarm.message;
                                        arrAlarm[result].type = returnAlarm.type;
                                        arrAlarm[result].state = returnAlarm.state;
                                        arrAlarm[result].timestamp = returnAlarm.timestamp;
                                    }

                                }
                            } else {    //Alarm not existing
                                if (returnAlarm.type != 'OK' && returnAlarm.type != 'OFF') {
                                    mqttClient.publish(mqttAlarmTopic, JSON.stringify(returnAlarm, null, 4), retainOption);
                                    if (arrAlarm.length < 1000) {
                                        arrAlarm.push({
                                            deviceID: returnAlarm.deviceID,
                                            source: returnAlarm.source,
                                            value: returnAlarm.value,
                                            message: returnAlarm.message,
                                            type: returnAlarm.type,
                                            state: returnAlarm.state,
                                            timestamp: returnAlarm.timestamp
                                        });
                                    } else { //Oversize
                                        arrAlarm.splice(0,1);   //Remove the oldest alarm
                                        arrAlarm.push({
                                            deviceID: returnAlarm.deviceID,
                                            source: returnAlarm.source,
                                            value: returnAlarm.value,
                                            message: returnAlarm.message,
                                            type: returnAlarm.type,
                                            state: returnAlarm.state,
                                            timestamp: returnAlarm.timestamp
                                        });
                                    }

                                }
                            }

                            variableIndex++;
                            callback1();
                        })
                    } else {
                        variableIndex++;
                        callback1();
                    }
                },
                function () {
                    plcIndex++;
                    callback();
                }
            )
        }
    )
}

//Return variable index
function getVariableInfo(variableName) {
    for (var i = 0; i < deviceConfig.PLCs.length; i++) {
        if (variableName.includes(deviceConfig.PLCs[i].name + '_')) {
            var _variable = variableName.replace(deviceConfig.PLCs[i].name + '_', '');
            for (var j = 0; j < deviceConfig.PLCs[i].variables.length; j++) {
                if (_variable == deviceConfig.PLCs[i].variables[j].name) {
                    return {
                        protocol: deviceConfig.PLCs[i].protocol,
                        plcAddress: deviceConfig.PLCs[i].ipAddress,
                        variableAddress: deviceConfig.PLCs[i].variables[j].address,
                        dataType: deviceConfig.PLCs[i].variables[j].dataType,
                        access: deviceConfig.PLCs[i].variables[j].access
                    }
                }
            }
        }
    }
    return null;
}

//Find alarm with source name
function findAlarm(source, type, callback) {
    if (!type) {
        for (var i = 0; i < arrAlarm.length; i++) {
            if (arrAlarm[i].source == source) return callback(i);
        };
        return callback(-1);
    } else {
        for (var i = 0; i < arrAlarm.length; i++) {
            if (arrAlarm[i].source == source && arrAlarm[i].type == type) return callback(i);
        };
        return callback(-1);
    }

}

//Compare two arrays and return different position
function compareArrays(oldArr, newArr) {
    var returnIndex = [];
    if (oldArr.length == newArr.length) {
        for (var i = 0; i < oldArr.length; i++) {
            if (oldArr[i].value != newArr[i].value) returnIndex.push(newArr[i]);
        }
    }
    return returnIndex;
}