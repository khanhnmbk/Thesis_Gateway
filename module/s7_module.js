var nodes7 = require('nodes7');  // This is the package name, if the repository is cloned you may need to require 'nodeS7' with uppercase S
var color = require('colors');
var arrPLCs = [];
var arrDataType = ['Bool' , 'Int' , 'Long', 'Double', 'String'];

//Initialize new connection (PLC)
//Slot 2 for S7-300/ S7-400, slot 1 for S7-1200/ S7-1500
function initConnection(plcName, plcAddress, plcPort, plcRack, plcSlot , callback) {
	var newPLC = new nodes7;
	newPLC.initiateConnection({
		port : plcPort,
		rack : plcRack,
		slot : plcSlot,
		host : plcAddress,
		timeout : 10000, //10 seconds timeout
	}, function(err) {
		if (typeof(err) != 'undefined') {
			console.log(err .red);
			callback(null)
		} else {
			console.log('Successfully connected to: ' .green,  plcAddress .green);
			callback({
				name : plcName,
				s7Node : newPLC,
				address : plcAddress,
			}); 
		}
	})
}

//Add items to the internal reading list
//Argument: "item" can be a single variable address or an array of addresses
function initReadingList(s7Connection, items) {
	if (s7Connection) s7Connection.addItems(items);
}

//Read all data
function readAllData(s7Connection, callback) {
	s7Connection.readAllItems(function(err, values) {
		if (err) {
			console.log(err);
			callback({});
		} else {
			callback(values);
		}
	})
}

//Convert Siemens address to nodeS7 address
function modifyAddress(address , datatype) {
	var modifiedAddress = address;
	if (address.includes('DB')) {	//Datablock
		modifiedAddress = address.replace('.' , ',');
		switch(datatype) {
			case 'Bool' : {
				if (address.includes('DBX')) modifiedAddress = modifiedAddress.replace('DBX' , 'X');
				break;
			}
			case 'Double' : {
				if (address.includes('DBD')) modifiedAddress = modifiedAddress.replace('DBD' , 'R');
				break;
			}
			case 'sInt' : {
				if (address.includes('DBW')) modifiedAddress = modifiedAddress.replace('DBW' , 'I');
				else if (address.includes('DBB')) modifiedAddress = modifiedAddress.replace('DBB' , 'B');
				break;
			}
			case 'uInt' : {
				if (address.includes('DBW')) modifiedAddress = modifiedAddress.replace('DBW' , 'W');
				else if (address.includes('DBB')) modifiedAddress = modifiedAddress.replace('DBB' , 'B');
				break;
			}
			case 'sDInt' : {
				if (address.includes('DBD')) modifiedAddress = modifiedAddress.replace('DBD' , 'DI');
				break;
			}
			case 'uDInt' : {
				if (address.includes('DBD')) modifiedAddress = modifiedAddress.replace('DBD' , 'DW');
				break;
			}
			case 'String' : {
				if (address.includes('DBS')) modifiedAddress = modifiedAddress.replace('DBS' , 'S') + '.254';
			}
		}
	} else {	//PLC tags
		switch(datatype) {
			case 'Double' : {
				if (address.includes('MD')) modifiedAddress = address.replace('MD' , 'MR');
				break;
			}
			case 'sInt' : {
				if (address.includes('MW')) modifiedAddress = address.replace('MW' , 'MI');
				else if (address.includes('MB')) modifiedAddress = address.replace('MB' , 'MI');
				break;
			}
			case 'sDInt' : {
				if (address.includes('MD')) modifiedAddress = address.replace('MD' , 'MDI');
				break;
			}
		}
	
	}
	return modifiedAddress;
	
}

function writeData(s7Connection, addresses, values) {
	s7Connection.writeItems(addresses, values, function(err) {
		if (err) console.log('Fail to set S7-Connection value' .red);
		else console.log('Set S7-Connection value succeeded' .green);
	});
}

module.exports.initConnection = initConnection;
module.exports.initReadingList = initReadingList;
module.exports.readAllData = readAllData;
module.exports.modifyAddress = modifyAddress;
module.exports.writeData = writeData;