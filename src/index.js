require('dotenv').config();
//import express from 'express';
const express = require('express');
//express for the website and pug to create the pages
const app = express();
bodyParser = require('body-parser');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine','pug');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
var request = require("request");

//rate limiting to protect the demos
const rateLimit = require("express-rate-limit");
app.use(
	rateLimit({
	  windowMs:  60 * 60 * 1000, // 1 hour duration in milliseconds
	  max: 5,
	  message: "You exceeded 5 requests in 1 hour.",
	  headers: true,
	})
  );


//apivideo
//const apiVideo = require('@api.video/nodejs-sdk');
//august 2021 update to the new Node JS api client
const apiVideoClient = require('@api.video/nodejs-client');

//if you chnage the key to sandbox or prod - make sure you fix the delegated toekn on the upload page
const apiVideoKey = process.env.apiProductionKey;
client = new apiVideoClient({ apiKey: apiVideoKey});


// website demo
//get request is the initial request - load the HTML page with the form
app.get('/', (req, res) => {
		res.sendFile(path.join(__dirname, '../public', 'index.html'));  
});


app.post('/createVideo', (req,res) => {
	console.log("request body",req.body);
	//now we'll make 2 rewquests to apivideo
	//1 create a videoId for the uppload, with any desired params
	//2 create a delegated token for the upload
	var public = true;
	var title = req.body.title;
	var descr = req.body.description;

	console.log("title", title);
	
	
	let result = client.videos.create({	"title": title, "mp4Support": mp4,
		"public": public, 
		"description": descr,					
	});
	console.log(result);
	result.then(function(video) {
		console.log(video);
		var videoId = video.videoId;
		console.log(videoId);
		//create a delegated token. The Node API client supports this.
		//const tokenCreationPayload = ''; // 
		//tokenCreationPayload.setTtl()=90; // Time in seconds that the token will be active. A value of 0 means that the token has no exipration date. The default is to have no expiration.
		const ttl = 90;
		let tokenResult = client.uploadTokens.createToken({"ttl": ttl});
		tokenResult.then(function (token){
			console.log("token",token);
			var delegatedToken = token.token;
			var tokenExpiry = token.expiresAt;
			console.log("new token", delegatedToken);
			console.log("new token expires", tokenExpiry);
			var tokenVideoIdJson = {"token": delegatedToken,
									"expires":tokenExpiry,
									"videoId": videoId};
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(tokenVideoIdJson));

		});

		/*
		//ok have a new videoId for the video - now create a delegated token
		//since the new delegated token with TTL is not yet in the Node SDK, I'll have to authenticate 
		//and then request a token - 2 calls to api.video
		var authOptions = {
			method: 'POST',
			url: 'https://ws.api.video/auth/api-key',
			headers: {
				accept: 'application/json'
				
			},
			json: {"apiKey":apiVideoKey}

		}
		console.log(authOptions);	
		request(authOptions, function (error, response, body) {
			if (error) throw new Error(error);
			//this will give me the api key
			
			var authToken = body.access_token;
			console.log(authToken);
			//now use this to generate a delegated toke with a ttl of 90s
			var tokenTTL = 90;
			var tokenOptions = {
				method: 'POST',
				url: 'https://ws.api.video/upload-tokens',
				headers: {
					accept: 'application/json',
					authorization: 'Bearer ' +authToken
				},
				json: {"ttl":tokenTTL}
	
			}
			request(tokenOptions, function (error, response, body) {
				if (error) throw new Error(error);
				var delegatedToken = body.token;
				var tokenExpiry = body.expiresAt;
				console.log("new token", delegatedToken);
				console.log("new token expires", tokenExpiry);
				var tokenVideoIdJson = {"token": delegatedToken,
										"expires":tokenExpiry,
										"videoId": videoId};
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(tokenVideoIdJson));

			});


			
	 	   
		});	
		*/
		
	}).catch((error) => {
		console.log(error);
	});	




});




//testing on 3021
app.listen(process.env.PORT || 3021, () =>
  console.log('Example app listening on port 3021!'),
);
process.on('uncaughtException', function(err) {
    // handle the error safely
    console.log(err)
    // Note: after client disconnect, the subprocess will cause an Error EPIPE, which can only be caught this way.
});



	