
window.onload  = function(){ 

    const watermarkInput = document.getElementById('watermark-file');
    const watermarkName = document.getElementById('watermark-filename');

    var statusButton = document.getElementById("statusButton");
   
    
    //update div with filename on change
    watermarkInput.addEventListener('change',() =>{
     ///   console.log(watermarkInput.files[0]);
        watermarkName.innerHTML = watermarkInput.files[0].name;

    });

    const backgroundInput = document.getElementById('background-file');
    const backgroundName = document.getElementById('background-filename');
   
        //update div with filename on change
        backgroundInput.addEventListener('change',() =>{
     //       console.log(backgroundInput.files[0]);
            backgroundName.innerHTML = backgroundInput.files[0].name;
    
        });

    const input = document.querySelector('#video-file');
        

    var url ="https://sandbox.api.video/upload?token=";
    var chunkCounter =0;
    //break into 1 MB chunks for demo purposes
    //new mim chunk size is 5MB (august 2021)
    const chunkSize = 6000000;  
    var videoId = "";
    var playerUrl = "";
    var file;
    var filename;
    var numberofChunks;

    input.addEventListener('change', () => {
        console.log("click!");
        //upload the images and create tokens and upload files.  But first.. did they give us the 2 images we need?
        if(backgroundInput.files[0] && watermarkInput.files[0]){
            //we can upload stuff
              //first we're goig to call getDelegatedTokeb to create 2 videoIDs, get a token, and uplaod the 2 images
            getDelegatedToken(videoName.value, videoDescription.value, backgroundInput.files[0], watermarkInput.files[0]);
            function getDelegatedToken(title, description, bgImage, wmImage){
                videoId="";
                console.log(title, description);
                var qReq = new XMLHttpRequest();
                var bumperForm = new FormData();

                //add the 2 files.
               bumperForm.append('backgroundFile', bgImage,backgroundInput.files[0].name );
                bumperForm.append('watermarkFile', wmImage, watermarkInput.files[0].name);
                bumperForm.append('title', title);
                 bumperForm.append('description', description);
                console.log("bumperForm",bumperForm);
                qReq.open("POST", "/createVideo");
                
                qReq.onload = function (oEvent) {
                    
                    console.log(qReq.status);
                    //once we create the video id do stuff
                    if(qReq.status == 429){
                        //rate limited
                        document.getElementById("token-information").innerHTML = "Your uploads have been rate limited. We allow 5 uploads/hour with this demo app. Please try again in a bit."
                    }
                    else{
                        console.log("token in response");
                        // images are uploaded to the server and available for viewing.
                        //  delegated token is returned, 
                        // videoId is retruned.
                        
                        var tokenVideoId = JSON.parse(qReq.response);
                        
                        console.log(tokenVideoId);
                        //TODO grabVideoId and token ID
                        videoId = tokenVideoId.videoId;
                        bgPath = tokenVideoId.bgFile;
                        wmPath = tokenVideoId.wmFile;
                        title =tokenVideoId.title;
                        descr = tokenVideoId.descr;
                        var delegatedToken = tokenVideoId.token;
                        const uploader = new VideoUploader({
                            file: input.files[0],
                            videoId: videoId,
                            //changed to sandbox, becuase we cannot have nice things
                            uploadToken: delegatedToken,
                            chunkSize: 1024*1024*10, // 10MB
                            retries: 10
                        });
                        uploader.onProgress((event) => {
                            var percentComplete = Math.round(event.currentChunkUploadedBytes / event.chunksBytes * 100);
                            var totalPercentComplete = Math.round(event.uploadedBytes / event.totalBytes * 100);
                            document.getElementById("chunk-information").innerHTML = "Chunk # " + event.currentChunk + " is " + percentComplete + "% uploaded. Total uploaded: " + totalPercentComplete +"%";
                        })
                        uploader.upload()
                            .then((video) => {
                                console.log(video);
                                playerUrl = video.assets.player;
                                console.log("Images & video uploaded! We are now creating your video with bumpers." ) ;
                                document.getElementById("video-information").innerHTML = "Images & video uploaded! We are now creating your video with bumpers." ;
                                document.getElementById("chunk-information").innerHTML ="";
                                uploadTheBumperText();
                            });
                    }
                }
                qReq.send(bumperForm);

            
                function uploadTheBumperText() {
                    const introTitle = document.getElementById('introtitle').value;
                    const introTitle2 = document.getElementById('introtitle2').value;
                    const outroTitle = document.getElementById('outrotitle').value;
                    const outroTitle2 = document.getElementById('outrotitle2').value;
                    var pReq = new XMLHttpRequest();
                    var titleJson = {
                        "introTitle":introTitle,
                        "introTitle2":introTitle2,
                        "outroTitle":outroTitle,
                        "outroTitle2":outroTitle2,
                        "videoId": videoId,
                        "bgpath": bgPath,
                        "wmpath": wmPath, 
                        "title":title, 
                        "descr":descr
                    };
                    console.log ("titleJson", titleJson);

                    pReq.open("POST", '/trackprogress' );
                    pReq.setRequestHeader("Content-type", "application/json");
                    pReq.onload = function (oEvent) {
                        //this means files are uploaded, and the process is underway. Now we add the button to check the status of the video
                        console.log(pReq.response);
                        var idtoCheck = pReq.response;
                        document.getElementById("video-information").innerHTML = "video created at api.video, and the bumpers are being created.";
                        
                        console.log("statusbutton", statusButton);
                        //button visible now
                        statusButton.style.visibility="inherit";
                        statusButton.addEventListener('click', () =>{
                            //call the status endpoint
                            var rReq = new XMLHttpRequest();
                            rReq.open("POST", '/videoprogress' );
                            rReq.setRequestHeader("Content-type", "application/json");
                            var VideoIdJson = {
                                "idToCheck":idtoCheck
                            }
                            rReq.onload = function (oEvent) {
                                //not pretty atm
                                finalJson = JSON.parse(rReq.response);
                                var finalURL = finalJson.finalPlayerURL;
                                
                                document.getElementById("status").innerHTML = rReq.response + "<br/> <iframe src=\""+finalURL+"\" width="100%" height="100%" frameborder="0" scrolling="no" allowfullscreen="true"></iframe>";
                            }
                            rReq.send(JSON.stringify(VideoIdJson));

                        })
                    }
                    pReq.send(JSON.stringify(titleJson));


                }
            
            
            
            
            
                
            
                    
                    
                
            }

   

        }else{
            document.getElementById("token-information").innerHTML = "Please add both a watermark image and a background image";

        }

    });
}