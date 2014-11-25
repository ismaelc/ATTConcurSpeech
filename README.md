## Sending expense to Concur with AT&T's Speech API
This code demonstrates how to submit business expense with voice using [AT&T's Speech Recognition API](http://developer.att.com/apis/speech) and the [Concur SDK](https://github.com/concur/concur-platform-sdk-js).  You can check out the demo video [here](https://www.youtube.com/watch?v=SR7ZqeG38ZM)

<img src="https://jfqcza.bn1301.livefilestore.com/y2pAadkatL5OnCjt3D6gJvJz_-T2YbRGnxNv7gW-TWIxHufH0-PhJm8MpoTto1beuZLmE01iZ-PNNWz7z3JmQCvFBVkh8m2msnskbuXofQppGc/ConcurATTdiagram.PNG?psid=1" width="800px" />

The diagram above describes the flow of the demo, and the file/code where each logic is located.  The Code section below will explain how this all works. This code uses the HTML5 Audio API (use Chrome) to record voice, and node.js to drive the backend (primarily to accept client calls and call out web APIs). The AudioRecorder code is credited to Chris Wilson (check out his other demos [here](http://webaudiodemos.appspot.com/)).

### Configuration
You would need to sign up for three developer accounts:

- [Firebase](https://www.firebase.com/signup/) - Used to store/transfer the audio between the client and server
- [AT&T Developer](https://developer.att.com/developer/flow/apiPlaygroundFlow.do?execution=e1s1) - Speech API to translate audio into text
- [Concur Developer](https://developer.concur.com/register) - QuickExpense API to submit expense amount to Concur

Once you've signed up for all the three accounts above, you need to manually generate the access token for AT&T and Concur in the `config.js` file described below.  Follow these links on how to do that:

- [Generate AT&T Developer access token](http://developer.att.com/apis/speech/docs)
- [Generate Concur Developer access token](https://developer.concur.com/oauth-20/native-flow)

For Firebase, you simply need to add your Firebase URL that ends with `firebaseio.com`

    config.att.accessToken = "<insert AT&T access token here>";
    config.concur.accessToken = "<insert Concur access token here>";
    config.firebase.url = "<insert Firebase URL here>";

### Code
Please refer to the diagram at the top of this README to follow the code explanation below:

1. Tap the microphone icon on the app to start recording voice. Tap it again to end recording.
2. Capture voice into blob.  The function below will already hold the audio `blob`, ready to be sent Firebase
             
        function doneEncoding( blob ) {
	      // sendVoiceToNode called in concuratt.js
	      sendVoiceToNode(blob);
          Recorder.setupDownload( blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav" );
          recIndex++;
        }
3. Trigger server to wait; Send B64'd blob to Firebase

        // set up POST call as trigger to wait for Firebase to receive the B64 voice/binary file
	    var xhr = new XMLHttpRequest();
	    xhr.open("POST", '/receiveVoice', true);
	    xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

	    // send the call to trigger server into wait mode
	    xhr.send(JSON.stringify(data));

	    // ... and send B64'd blob to Firebase
	    sendToFirebase(blob, id);
4. Receive Base-64'd  blob from Firebase

        // receive B64'd blob from Firebase
        myVoiceRootRef.on('child_added', function(snapshot) {
	         if (!newVoiceItems) return; // Keep from loading entire list

	         var fbaseObj = snapshot.val();

	         var b64string = fbaseObj.voiceBlobBase64;
	         var buf = new Buffer(b64string, 'base64');
	         
	         ...
	    })
	    
5. Call AT&T Speech API on voice blob

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
			   ...
		    });
		});
		
	    req.on('error', function (e) {
		   // TODO: handle error.
		   console.log(e);
	    });

	    // make the request to AT&T Speech Recognition API
	    req.write(buf);
	    req.end();		
6. Send expense to Concur through QuickExpense API using the [Concur SDK](https://github.com/concur/concur-platform-sdk-js)
       
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
	      }

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

### Support
If you have questions about this code, please email me at chris.ismael@concur.com 
