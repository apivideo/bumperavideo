require('dotenv').config();
//import express from 'express';
const express = require('express');
//express for the website and pug to create the pages
const app = express();
bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '2Gb'}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine','pug');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
var timeout = require('connect-timeout');

//files
var fs = require('fs');
const formidable = require('formidable');
const path = require('path');


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



//shotstack SDK
const Shotstack = require('shotstack-sdk');
const defaultClient = Shotstack.ApiClient.instance;
const DeveloperKey = defaultClient.authentications['DeveloperKey'];
const api = new Shotstack.EditApi();
//set to shotstack staging (for now)
let apiUrl = 'https://api.shotstack.io/stage';
defaultClient.basePath = apiUrl;
DeveloperKey.apiKey = process.env.SSapiKey;


//array of video created
var videocreationList=[];

//apivideo
//const apiVideo = require('@api.video/nodejs-sdk');
//august 2021 update to the new Node JS api client
const apiVideoClient = require('@api.video/nodejs-client');
const { default: CaptionsListResponse } = require('@api.video/nodejs-client/lib/model/CaptionsListResponse');
const { Edit } = require('shotstack-sdk');



//if you chnage the key to sandbox or prod - make sure you fix the delegated toekn on the upload page
const apiVideoKey = process.env.apiProductionKey;
const SSapikey = process.env.SSapiKey;
client = new apiVideoClient({ apiKey: apiVideoKey});





//get request is the initial request - load the HTML page with the form
app.get('/', (req, res) => {
		//res.sendFile(path.join(__dirname, '../public', 'index.html'));  
});


app.post('/createVideo', (req,res) => {
	
	console.log("createvideo");
	//now we'll make 2 rewquests to apivideo
	//1 create a videoId for the uppload, with any desired params
	//2 create a delegated token for the upload
	
	var form = new formidable.IncomingForm({maxFileSize : 2000 * 1024 * 1024}); //2 Gb
	console.log(form);
	form.parse(req, (err, fields, files) => {

		if (err) {
			console.error('form Error', err);
			throw err;
		}


		var title = fields.title;
		var descr = fields.description;
		console.log(title, descr);
		console.log("BG data", JSON.stringify(files.backgroundFile));
		console.log("WM data", JSON.stringify(files.watermarkFile));
		//now lets move these 2 images to /public/images - so they are on the server
		var newPath = __dirname + "/../public/images/";
		console.log("newPath",newPath);
		var bgPath = files.backgroundFile.path;
		var bgName = path.parse(files.backgroundFile.name).name;
		
		var newbgPath = newPath + bgName ;
		var wmPath = files.watermarkFile.path;
		var wmName = path.parse(files.watermarkFile.name).name;

		var newWmPath = newPath +wmName;
		fs.copyFile(bgPath, newbgPath, function (err) {
			if (err) throw err;
		 console.log('File uploaded and moved!');
		//FILE IS RENAMED
			fs.copyFile(wmPath, newWmPath, function (err) {
				if (err) throw err;
			console.log('File uploaded and moved!');
			//FILE IS RENAMED
			});
	  	});

        
		let result = client.videos.create({	"title": title +" initial video",
			"description": descr					
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
										"videoId": videoId,
										//also need to send the background image and watermakr filenames - to resend back to the server
										"bgFile" : bgName,
										"wmFile" :wmName,
										"title":title, 
										"description":descr
										};
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(tokenVideoIdJson));

			});

			
			
			
			
			
		}).catch((error) => {
			console.log(error);
		});	
		
	});



});

function videoStatus (videocreationList, videoId){
	for(i=0; i< videocreationList.length;i++){
		if(videocreationList[i].initialvideoid ==videoId){
			//matched the video
			console.log("matched a video status");
			console.log(JSON.stringify(videocreationList[i]));

		}

	}


}


app.post('/trackprogress',timeout('60s'), (req,res) => {

	var videoProgressJson = { 	"initialvideoid":"",
								"mp4Created": false,
								"shotstackId" :"",
								"shotstackStatus": "not started",
								"finalVideoId": "",
								"final720pReady":false
							};

	var reqBody = (req.body);
	// we need all the title text strings
	console.log(reqBody);
	const introTitle = req.body.introTitle;
	const introTitle2 = req.body.introTitle2;
	const outroTitle = req.body.outroTitle;
	const outroTitle2 =req.body.outroTitle2;
	console.log ("all the texts", introTitle+"  "+ introTitle2+"  "+ outroTitle+"  "+ outroTitle2); 
	const bgpath = req.body.bgpath;
	const wmpath = req.body.wmpath;
	const title = req.body.title;
	const descr = req.body.descr;
	console.log("paths" ,bgpath+wmpath);
	//we need the videoId and the mp4 encoding type to check the webhook responses
	var videoId = reqBody.videoId;
	videoProgressJson.initialvideoid = videoId;
	videoStatus (videocreationList, videoId)
	//now that there is a videoId in the JSON, i'll push to the array of videos being processed
	videocreationList.push(videoProgressJson);
	var encodingType = "mp4";
	//has this videoId had a MP4 yet?
	function checkWebhook(videoId, encodingType, webhooks){
		foundMatch = false;
		console.log("there are " + webhooks.length + " webhook entries to scan");
		for(var i=0;i<webhooks.length;i++){
			if(webhooks[i].videoId === videoId && webhooks[i].encoding === encodingType){
				//we have a match!!
				foundMatch = true;
				//need mp4 URL now that it is created
				 getmp4 = client.videos.get(videoId);
				 videoProgressJson.mp4Created = true;
				 videoStatus (videocreationList, videoId)
				 getmp4.then(function (mp4Result){ 
					console.log("mp4Result", mp4Result);
					//grab mp4 URL
					const mp4Url = mp4Result.assets.mp4;
					getStatus = client.videos.getStatus(videoId);
					getStatus.then(function (statusResult){
						console.log("statusResult",statusResult);
						//grab the duration	
						const duration = statusResult.encoding.metadata.duration;
						console.log("mp4URL & duration", mp4Url + " " + duration);
						console.log(duration +4);

						//create our query for Shotstack
						//shotstack has a Node SDK
						//send to Shotstack

						//create the assets.. each asset goes in a clip

						//video asset
						let videoAsset = new Shotstack.VideoAsset;
							videoAsset.setSrc(mp4Url);
							videoAsset.setVolume(0.5);
						let videoClip =  new Shotstack.Clip;
							videoClip.setAsset(videoAsset);
							videoClip.setStart(4);
							videoClip.setLength(duration);

						//image assets
						let backgroundAsset = new Shotstack.ImageAsset;
							backgroundAsset.setSrc('https://bumper.a.video/images/'+bgpath)
						//2 clips for tha background - one at front one at back
						let introBGClip = new Shotstack.Clip;
							introBGClip.setAsset(backgroundAsset);
							introBGClip.setStart(0);
							introBGClip.setLength(4);
						let outroBGClip = new Shotstack.Clip;
							outroBGClip.setAsset(backgroundAsset);
							outroBGClip.setStart(4+duration);
							outroBGClip.setLength(4);


						let watermarkAsset = new Shotstack.ImageAsset;
							watermarkAsset.setSrc('https://bumper.a.video/images/'+wmpath)
						//watermark to run full video 
						let watermarkClip = new Shotstack.Clip;
							watermarkClip.setAsset(watermarkAsset);
							watermarkClip.setPosition("topLeft");
							watermarkClip.setOffset({"x": 0.05,"y": -0.05});
							watermarkClip.setOpacity(0.5);
							watermarkClip.setFit("none");
							watermarkClip.setStart(0);
							watermarkClip.setLength(4+duration+4);

						//text assets
						let titleIntroTextAsset =new Shotstack.TitleAsset;
							titleIntroTextAsset.setText(introTitle);
							titleIntroTextAsset.setStyle('chunk');
							titleIntroTextAsset.setColor('#ffffff');
							titleIntroTextAsset.setSize('x-large');
							titleIntroTextAsset.setPosition('center');
						let titleIntroClip = new Shotstack.Clip;
							titleIntroClip.setAsset(titleIntroTextAsset);
							titleIntroClip.setStart(0.1);
							titleIntroClip.setLength(3.9);

						let titleIntroTextAsset2 =new Shotstack.TitleAsset;
							titleIntroTextAsset2.setText(introTitle2);
							titleIntroTextAsset2.setStyle('chunk');
							titleIntroTextAsset2.setColor('#ffffff');
							titleIntroTextAsset2.setSize('large');
							titleIntroTextAsset2.setPosition('bottom');
						let titleIntroClip2 = new Shotstack.Clip;
							titleIntroClip2.setAsset(titleIntroTextAsset2);
							titleIntroClip2.setStart(0.2);
							titleIntroClip2.setLength(3.8);

						let titleouttroTextAsset =new Shotstack.TitleAsset;
							titleouttroTextAsset.setText(outroTitle);
							titleouttroTextAsset.setStyle('chunk');
							titleouttroTextAsset.setColor('#ffffff');
							titleouttroTextAsset.setSize('x-large');
							titleouttroTextAsset.setPosition('center');
						let titleOutroClip = new Shotstack.Clip;
							titleOutroClip.setAsset(titleouttroTextAsset);
							titleOutroClip.setStart(0.1+duration+4);
							titleOutroClip.setLength(3.9);


						let titleouttroTextAsset2 =new Shotstack.TitleAsset;
							titleouttroTextAsset2.setText(outroTitle2);
							titleouttroTextAsset2.setStyle('chunk');
							titleouttroTextAsset2.setColor('#ffffff');
							titleouttroTextAsset2.setSize('large');
							titleouttroTextAsset2.setPosition('bottom');
						let titleOutroClip2 = new Shotstack.Clip;
							titleOutroClip2.setAsset(titleouttroTextAsset2);
							titleOutroClip2.setStart(0.2+duration+4);
							titleOutroClip2.setLength(3.8);

						//all the assets in clips go in tracks

						let watermarkTrack = new Shotstack.Track;
							watermarkTrack.setClips([watermarkClip]);
						let mainTrack = new Shotstack.Track;
							mainTrack.setClips([introBGClip, titleIntroClip, titleIntroClip2, videoClip, outroBGClip, titleOutroClip, titleOutroClip2]);
						
						//all the tracks go in a timeline
						let timeline = new Shotstack.Timeline;
								timeline.setTracks([watermarkTrack, mainTrack]);
								//timeline.setTracks([ mainTrack]);
						//output is required
						let output = new Shotstack.Output;
							output.setFormat('mp4')
    						output.setResolution('1080');
							
						//The timeline and output go into an Edit
						let edit = new Shotstack.Edit;
							edit.setTimeline(timeline)
    						edit.setOutput(output);
						//send the video and the images & text to ShotStack
						api.postRender(edit).then((data) => {
							let message = data.response.message;
							let id = data.response.id
							
							console.log(message + '\n');
							console.log('>> Now check the progress of your render by running:');
							console.log('>> node examples/status.js ' + id);
							videoProgressJson.shotstackId = id;
							videoStatus (videocreationList, videoId);
							//checking status
							checkStatus(id);
							

						
						}, (error) => {
							console.error('Request failed: ', error);
							process.exit(1);
						});

						function checkStatus(id){

							api.getRender(id).then((data) => {
								let status = data.response.status;
								let url = data.response.url;
								videoProgressJson.shotstackStatus = status;
								videoStatus (videocreationList, videoId);
								console.log('Status: ' + status.toUpperCase() + '\n');
							
								if (status == 'done') {
									console.log('>> Asset URL: ' + url);
									updateApiVideo(url);
									
								} else if (status == 'failed') {
									console.log('>> Something went wrong, rendering has terminated and will not continue.');
									console.log(data.response.error);
								} else {
									console.log('>> Rendering in progress, please try again shortly.\n>> Note: Rendering may take up to 1 minute to complete.');
									setTimeout(checkStatus,2000,id);
								}
							}, (error) => {
								console.error('Request failed or not found: ', error);
								process.exit(1);
							});
						}
						function updateApiVideo(url){
							//ok so the video is created at Stostack
							const videoCreationPayload = {
								title: title, // The title of your new video.
								description: descr, // A brief description of your video.
								source: url, // If you add a video already on the web, this is where you enter the url for the video.
								
							}; 
							finalUpload =  client.videos.create(videoCreationPayload);
							finalUpload.then (function(finalVideo) {
								console.log(finalVideo);
								var finalvideoId = finalVideo.videoId;
								var finalPlayerURL = finalVideo.assets.player;
								console.log('finalvideoid',finalvideoId);
								console.log('finalPlayerURL',finalPlayerURL);
								res.send(finalPlayerURL);
								videoProgressJson.shotstackStatus = status;
								videoStatus (videocreationList, videoId);

							});
						}

					});


				 });
				

				 	
			}
		}
		if(!foundMatch){
			//no match yet, so wait 2 seconds and try again
			//not encoded yet, wait 2 sec and re-reun checkMp4
			console.log("no webhook yet.");
			setTimeout(checkWebhook,2000,videoId, encodingType, webhooks);
		}
	}
	checkWebhook(videoId, encodingType, webhooks);
});


//apivideo webhook
var webhooks = [];
webhookResponse = {"event":"intro", 
			"emittedAt": Date.now, 
			"videoId":"12345",
			"encoding":"hls",
			"quality": "200"
			}
webhooks.push(webhookResponse);
//receive a webhook that encoding is ready
app.post("/receive_webhook", function (request, response) {
	console.log("new video event from api.video");

	let body =request.body;
	console.log((body));
	let type = body.type;
	let emittedAt = body.emittedAt;
	let webhookResponse="";
	let liveStreamId = "";
	let liveStreamStatus = false;
	//we're only getting video.encoding.quality.completed right now.. but let's be careful in case the webhook changes

	if (type =="video.encoding.quality.completed"){
	  let videoId = body.videoId;
	  let encoding = body.encoding;
	  let quality = body.quality;
	  liveStreamId = body.liveStreamId;
	  webhookResponse = {"event":type, 
	  					"emittedAt": emittedAt, 
						"videoId":videoId,
						"encoding":encoding,
						"quality": quality
						}
	  
	} 
	webhooks.push(webhookResponse);
	response.sendStatus(200);  
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



	