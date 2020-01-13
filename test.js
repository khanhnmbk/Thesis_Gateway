var mqtt = require('mqtt');

let mqttOptions = {
    host: '192.168.1.123',
    port: 1883,
}

var i = 0;
let mqttClient = mqtt.connect(mqttOptions);
mqttClient.on('connect', function() {
    setInterval(function() {
        mqttClient.publish('Hello', 'Message ' + i);
        i++;
        console.log('Published');
    }, 2000);
})
