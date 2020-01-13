var moment = require('moment');

//Check alarm condition of a variable
function checkAlarm(alarmObject, deviceID, value) {
    // console.log('Alarm config object');
    // console.log(alarmObject);

    var returnAlarm = {
        deviceID : deviceID,
        source : alarmObject.name,
        value : value,
        message : null,
        type : alarmObject.currentAlarmState,
        state : 'UNACK',
        timestamp : moment().format('YYYY-MM-DD HH:mm:ss'),
    }

    //console.log('Current alarm state: ' .magenta, returnAlarm.type .magenta);
    if (alarmObject.alarmType == 0) { //Digital alarm
        if (value) {    //ON alarm
            returnAlarm.type = 'ON';
            returnAlarm.message = 'Value is ON';
        } else { //OFF alarm
            returnAlarm.type = 'OFF';
            returnAlarm.message = 'Value is OFF';
        }
    } else {    //Analog alarm
        switch(alarmObject.currentAlarmState) {
            case 'LOLO' : {
                //LOLO -> HIHI
                if (value >= alarmObject.parameters.hihi) {
                    returnAlarm.type = 'HIHI';
                    returnAlarm.message = 'Value is TOO HIGH';
                    alarmObject.currentAlarmState = 'HIHI';
                }
                //LOLO -> HI
                else if (value >= alarmObject.parameters.hi) {
                    returnAlarm.type = 'HI';
                    returnAlarm.message = 'Value is HIGH';
                    alarmObject.currentAlarmState = 'HI';
                }
                //LOLO -> OK
                else if (value >= (alarmObject.parameters.lo + alarmObject.parameters.deadband)) {
                    returnAlarm.type = 'OK';
                    returnAlarm.message = 'Value is OK';
                    alarmObject.currentAlarmState = 'OK'
                }
                //LOLO -> LO
                else if (value >= (alarmObject.parameters.lolo + alarmObject.parameters.deadband)) {
                    returnAlarm.type = 'LO';
                    returnAlarm.message = 'Value is LOW';
                    alarmObject.currentAlarmState = 'LO';
                } 
                //LOLO -> LOLO
                else {
                    returnAlarm.type = 'LOLO';
                    returnAlarm.message = 'Value is TOO LOW';
                    alarmObject.currentAlarmState = 'LOLO';
                } 
                break;
            };
            case 'LO' : {
                //LO -> LOLO
                if (value <= alarmObject.parameters.lolo) {
                    returnAlarm.type = 'LOLO';
                    returnAlarm.message = 'Value is TOO LOW';
                    alarmObject.currentAlarmState = 'LOLO';
                } 
                //LO -> HIHI
                else if (value >= alarmObject.parameters.hihi) {
                    returnAlarm.type = 'HIHI';
                    returnAlarm.message = 'Value is TOO HIGH';
                    alarmObject.currentAlarmState = 'HIHI'
                }
                //LO -> HI
                else if (value >= alarmObject.parameters.hi) {
                    returnAlarm.type = 'HI';
                    returnAlarm.message = 'Value is HIGH';
                    alarmObject.currentAlarmState = 'HI'
                }
                //LO -> OK
                else if (value >= (alarmObject.parameters.lo + alarmObject.parameters.deadband)) {
                    returnAlarm.type = 'OK';
                    returnAlarm.message = 'Value is OK';
                    alarmObject.currentAlarmState = 'OK';
                }
                //LO -> LO
                else {
                    returnAlarm.type = 'LO';
                    returnAlarm.message = 'Value is LOW';
                    alarmObject.currentAlarmState = 'LO';
                }
                break;
            }
            case 'OK' : {
                //OK -> LOLO
                if (value <= alarmObject.parameters.lolo) {
                    returnAlarm.type = 'LOLO';
                    returnAlarm.message = 'Value is TOO LOW';
                    alarmObject.currentAlarmState = 'LOLO'
                }
                //OK -> LO
                else if (value <= alarmObject.parameters.lo) {
                    returnAlarm.type = 'LO';
                    returnAlarm.message = 'Value is LOW';
                    alarmObject.currentAlarmState = 'LO';
                }
                //OK -> HIHI
                else if (value >= alarmObject.parameters.hihi) {
                    returnAlarm.type = 'HIHI';
                    returnAlarm.message = 'Value is TOO HIGH';
                    alarmObject.currentAlarmState = 'HIHI'
                }
                //OK -> HI
                else if (value >= alarmObject.parameters.hi) {
                    returnAlarm.type = 'HI';
                    returnAlarm.message = 'Value is HIGH';
                    alarmObject.currentAlarmState = 'HI';
                }
                //OK -> OK
                else {
                    returnAlarm.type = 'OK';
                    returnAlarm.message = 'Value is OK';
                    alarmObject.currentAlarmState = 'OK';
                }
                break;
            };
            case 'HI' : {
                //HI -> HIHI
                if (value >= alarmObject.parameters.hihi) {
                    returnAlarm.type = 'HIHI';
                    returnAlarm.message = 'Value is TOO HIGH';
                    alarmObject.currentAlarmState = 'HIHI';
                }
                //HI -> LOLO
                else if (value <= alarmObject.parameters.lolo) {
                    returnAlarm.type = 'LOLO';
                    returnAlarm.message = 'Value is TOO LOW';
                    alarmObject.currentAlarmState = 'LOLO'
                }
                //HI -> LO
                else if (value <= alarmObject.parameters.lo) {
                    returnAlarm.type = 'LO';
                    returnAlarm.message = 'Value is LOW';
                    alarmObject.currentAlarmState = 'LO'
                }
                //HI -> OK
                else if (value <= (alarmObject.parameters.hi - alarmObject.parameters.deadband)) {
                    returnAlarm.type = 'OK';
                    returnAlarm.message = 'Value is OK';
                    alarmObject.currentAlarmState = 'OK';
                }
                //HI -> HI
                else {
                    returnAlarm.type = 'HI';
                    returnAlarm.message = 'Value is HIGH';
                    alarmObject.currentAlarmState = 'HI';
                }
                break;
            };
            case 'HIHI' : {
                //HIHI -> LOLO
                if (value <= alarmObject.parameters.lolo) {
                    returnAlarm.type = 'LOLO';
                    returnAlarm.message = 'Value is TOO LOW';
                    alarmObject.currentAlarmState = 'LOLO'
                }
                //HIHI -> LO
                else if (value <= alarmObject.parameters.lo) {
                    returnAlarm.type = 'LO';
                    returnAlarm.message = 'Value is LOW';
                    alarmObject.currentAlarmState = 'LO'
                }
                //HIHI -> OK
                else if (value <= (alarmObject.parameters.hi - alarmObject.parameters.deadband)) {
                    returnAlarm.type = 'OK';
                    returnAlarm.message = 'Value is OK';
                    alarmObject.currentAlarmState = 'OK'
                }
                //HIHI -> HI
                else if (value <= (alarmObject.parameters.hihi - alarmObject.parameters.deadband)) {
                    returnAlarm.type = 'HI';
                    returnAlarm.message = 'Value is HIGH';
                    alarmObject.currentAlarmState = 'HI';
                }
                //HIHI -> HIHI
                else {
                    returnAlarm.type = 'HIHI';
                    returnAlarm.message = 'Value is TOO HIGH';
                    alarmObject.currentAlarmState = 'HIHI';
                }
                break;
            }
        }
    }

    return returnAlarm;
}


module.exports.checkAlarm = checkAlarm;