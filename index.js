var express = require('express'),
    config = require('./config');
var Firebase= require('firebase'),
    request = require('request'),
    https = require('https'),
    concur = require('concur-platform'),
    fs = require('fs');
var app = express();

app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

var bodyParser = require('body-parser');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use( bodyParser.urlencoded() ); // to support URL-encoded bodies

app.get('/', function(request, response) {
  response.send('Hello World!')
});

app.get('/AudioRecorder/js/concuratt.js', function(request, response) {
	fs.readFile('./concuratt.js', function(err, data) {
		response.header("Content-Type", "application/javascript");
		response.end(data.toString().replace("REPLACE_W_FIREBASE_CONFIG", config.firebase.url));
	});
});

// ========

var events = require('events');
var eventEmitter = new events.EventEmitter();

// when called from concuratt.js, will wait until AT&T Speech recognition triggers emitter
app.post('/receiveVoice', function(req, res) {
	var id = req.body.id;

	// probably need a timeout for this
	eventEmitter.once('sendBackToClient', function(message) {
		res.send(message);
	});
});

var myRootRef = new Firebase(config.firebase.url);
var myVoiceRootRef = myRootRef.child('voiceBlobB64');
var newVoiceItems = false;

myVoiceRootRef.once('value', function(messages) {
	newVoiceItems = true;
});

// receive B64'd blob from Firebase
myVoiceRootRef.on('child_added', function(snapshot) {
	if (!newVoiceItems) return; // Keep from loading entire list

	var fbaseObj = snapshot.val();

	var b64string = fbaseObj.voiceBlobBase64;
	var buf = new Buffer(b64string, 'base64');

	// set up call to AT&T Speech Recognition on blob turned to buffer
	var headers = {
		'Content-Type': 'audio/wav',
		'Authorization': 'Bearer ' + config.att.accessToken,
		'Accept' : 'application/json'
	};

	var options = {
		host: 'api.att.com',
		path: '/speech/v3/speechToText',
		method: 'POST',
		headers: headers
	};

	// Setup the request.
	var req = https.request(options, function (res) {
		res.setEncoding('utf-8');

		var responseString = '';

		res.on('data', function (data) {
			responseString += data;
		});

		res.on('end', function () {
			console.log("Response: " + responseString);
			var responseJSON = JSON.parse(responseString);
			var resultArray = responseJSON.Recognition.NBest[0].Hypothesis.split(" ");

			var number = 0;
			var multiple = 0;
			var prevMultiple = 999;
			var wholeTotal = 0;
			var decimalTotal = 0;
			var countDecimal = false;

			for (i = 0; i < resultArray.length; i++) {

				number = resultArray[i].toLowerCase().replace(/\./g,'');
				if(isNaN(number)) number = text2num(number);
				multiple = getMultiplesOfTen(number);
				if(prevMultiple > multiple && !countDecimal) { //start counting towards whole total
					wholeTotal += number;
				}
				else {						  // count towards decimal total
					decimalTotal += number;
					countDecimal = true;
				}

				prevMultiple = multiple;
			}

			if(decimalTotal.toString().length == 1) decimalTotal = "0" + decimalTotal;

			var floatAmount = parseFloat(wholeTotal + "." + decimalTotal);
			eventEmitter.emit('sendBackToClient', floatAmount + '');
		});
	});

	req.on('error', function (e) {
		// TODO: handle error.
		console.log(e);
	});

	// make the request to AT&T Speech Recognition API
	req.write(buf);
	req.end();

});

// Upon confirmation from user, send amount to Concur
app.post('/receiveExpense', function(req, res) {

	var amount = req.body.amount;

	var now = new Date();
	var year = now.getFullYear();
	var month = now.getMonth();
	var date = now.getDate();

	var fullDate = year + '-' + (month +1) + '-' + date;

	var concurBody = {
		"CurrencyCode": "USD",
		"TransactionAmount": amount,
		"TransactionDate": fullDate
	}

	var options = {
		oauthToken: config.concur.accessToken,
		contentType:'application/json',
		body:concurBody
	};

	concur.quickexpenses.send(options)
	.then(function(data){
		//Contains the ID and URI to the resource
		console.log("QuickExpense created! " + amount);
		res.send("QuickExpense created! " + amount);
	})
	.fail(function (error) {
		//Error contains the error returned
		console.log(error);
	});

});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})

// Utility

var Small = {
    'zero': 0,
    'one': 1,
    'two': 2,
    'three': 3,
    'four': 4,
    'five': 5,
    'six': 6,
    'seven': 7,
    'eight': 8,
    'nine': 9,
    'ten': 10,
    'eleven': 11,
    'twelve': 12,
    'thirteen': 13,
    'fourteen': 14,
    'fifteen': 15,
    'sixteen': 16,
    'seventeen': 17,
    'eighteen': 18,
    'nineteen': 19,
    'twenty': 20,
    'thirty': 30,
    'forty': 40,
    'fifty': 50,
    'sixty': 60,
    'seventy': 70,
    'eighty': 80,
    'ninety': 90
};

var Magnitude = {
    'thousand':     1000,
    'million':      1000000,
    'billion':      1000000000,
    'trillion':     1000000000000,
    'quadrillion':  1000000000000000,
    'quintillion':  1000000000000000000,
    'sextillion':   1000000000000000000000,
    'septillion':   1000000000000000000000000,
    'octillion':    1000000000000000000000000000,
    'nonillion':    1000000000000000000000000000000,
    'decillion':    1000000000000000000000000000000000,
};

var a, n, g;

function text2num(s) {
    a = s.toString().split(/[\s-]+/);
    n = 0;
    g = 0;
    a.forEach(feach);
    return n + g;
}

function feach(w) {
    var x = Small[w];
    if (x != null) {
        g = g + x;
    }
    else if (w == "hundred") {
        g = g * 100;
    }
    else {
        x = Magnitude[w];
        if (x != null) {
            n = n + g * x
            g = 0;
        }
        else {
            console.log("Unknown number: "+w);
        }
    }
}

function getMultiplesOfTen(number){
   number = parseInt(number);
   if(typeof(number)!=="number") return number;
    var result = {};

	(function breakDown(num){
        if(isNaN(num))return num;//if it's invalid return
		if(num<=0)return false;
		num = num.toFixed(0);//get rid of decimals

		var divisor = Math.pow(10,num.length-1),//ex. when num = 300, divisor = 100
		quotient = Math.floor(num/divisor);

		result[divisor]=quotient;//add it to our object
		quotient = Math.floor(num/divisor);

		result[divisor]=quotient;//add it to our object
		breakDown(num % divisor);//break down the remainder
	})(number);
		//return result as an object
		var output = "";
		for(var prop in result) {
			output = prop;
			break;
		}

		return output;
}
