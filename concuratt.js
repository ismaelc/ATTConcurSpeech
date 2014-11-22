var myRootRef = new Firebase('REPLACE_W_FIREBASE_CONFIG');
var myVoiceRootRef = myRootRef.child('voiceBlobB64');

function sendVoiceToNode(blob) {
	var id = randomString(32, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

	// this was supposed to tie the binary back to an id, but serves no purpose for now
	// other than being carried as a small payload in case it is needed for future
	// multi-user scenarios
	var data = { id : id }

	// set up POST call as trigger to wait for Firebase to receive the B64'd voice/binary file
	var xhr = new XMLHttpRequest();
	xhr.open("POST", '/receiveVoice', true);
	xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

	// send the call to trigger server into wait mode
	xhr.send(JSON.stringify(data));

	// ... and send B64'd blob to Firebase
	sendToFirebase(blob, id);

	// callback would receive a voice-recognized expense amount
	xhr.onloadend = function () {
		var amt = xhr.responseText;

		// user gets a prompt to confirm whether the expense amount should be sent to Concur
		bootbox.confirm("Send " + amt + " to Concur as QuickExpense?", function(result) {
			// send to Concur if user accepts
			if(result) sendAsQuickExpense(amt);
		});
	};
}

function randomString(length, chars) {
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
}

function sendToFirebase(blob, id) {
	  blobToBase64(blob, function(x) {
		myVoiceRootRef.push({ voiceBlobBase64: x, id : id});
	  });
}

var blobToBase64 = function(blob, cb) {
      var reader = new FileReader();
      reader.onload = function() {
        var dataUrl = reader.result;
        var base64 = dataUrl.split(',')[1];
        cb(base64);
      };
      reader.readAsDataURL(blob);
}

function sendAsQuickExpense(amount) {

	var data = {
		accessToken : "zzz", // TODO: Pull access token from Concur passport SDK
		amount : amount
	}

	// construct an HTTP request
	var xhr = new XMLHttpRequest();
	xhr.open("POST", '/receiveExpense', true);
	xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

	// send the collected data as JSON
	xhr.send(JSON.stringify(data));

	xhr.onloadend = function () {
		bootbox.alert(xhr.responseText, function() {
			//Example.show(xhr.responseText);
		});
	};
}


