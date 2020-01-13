var alarm = require('../module/alarm_module');

var alarmObject = {
    name : 'Speed',
    isAlarm : true,
    alarmType : '1', // 0 : Digital -- 1 : Analog
    parameters : {
        lolo : 100,
        lo : 500,
        hi : 1000, 
        hihi : 1500,
        deadband : 50
    },
    currentAlarmState : 'OK'
}

var testValue = 1500;

setInterval(function() {
    testValue = parseInt(Math.random() * 1500, 10);
    var result  = alarm.checkAlarm(alarmObject, '123456', testValue);
    console.log(result);
}, 2000)

