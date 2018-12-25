/////////////////////////////////////////////////////////
// Canvas Blocker &								       //
// Firefox privacy.resistFingerprinting Detector.      //
// https://github.com/johnozbay/canvas-block-detector  //
// (c) 2018 // JOHN OZBAY // CRYPT.EE 			   	   //
// MIT License									       //
/////////////////////////////////////////////////////////

var blockDetectionCanvas;
function isCanvasBlocked () {
	// create a 1px image data
	blockDetectionCanvas = blockDetectionCanvas || document.createElement("canvas");
	var blocked = false;
	var ctx = blockDetectionCanvas.getContext("2d");
	
	if (ctx) {
		var imageData = ctx.createImageData(1,1);
		var originalImageData  = imageData.data;

		// set pixels to RGB 0
		originalImageData[0]=0; 
		originalImageData[1]=0; 
		originalImageData[2]=0; 
		originalImageData[3]=255;
		
		// set this to canvas
		ctx.putImageData(imageData,1,1); 
		
		// now get the data back from canvas.
		var checkData = ctx.getImageData(1,1,1,1).data;

		// If this is firefox, and privacy.resistFingerprinting is enabled,
		// OR a browser extension blocking the canvas, 
		// This will return RGB all white (255,255,255) instead of the (0,0,0) we put.

		// so let's check the R and G to see if they're 255 or 0 (matching what we've initially set)
		if (originalImageData[0] !== checkData[0] && originalImageData[1] !== checkData[1]) {
			blocked = true;
			console.log("Canvas is blocked. Will display warning.");
		}
	} else {
		blocked = true;
		console.log("Canvas is blocked. Will display warning.");
	}
	return blocked;
}

/////////////////////////////////////////////////////
// END OF MIT LICENSED CODE. THE REST IS UP FOR GRABS  //
/////////////////////////////////////////////////////








function showCanvasBlockedModal () {
	var canvasModalHTML = '<div class="modal is-active warning-modal" id="canvas-blocked-modal">'+
	  '<div class="modal-background" onclick="hideActiveWarningModal();"></div>'+
	  '<div class="modal-content">'+
	    '<div class="crypteecard">'+
	    	'<img src="../imgs/canvas-birds.jpg">'+
	    	'<div class="content">'+
	    		'<p class="title is-5">Canvas Blocker Detected</p>'+
	    		"<p>Photos come in all shapes and sizes. And they need to be cropped and resized to generate thumbnails. Unencrypted services do this on their servers because they can see &amp; access your photos. With Cryptee, your photos are encrypted on your device using your encryption key so that even we can't access them. To achieve this level of zero-knowledge, thumbnails need to be generated using your browser's canvas on your device before they're encrypted.<br><br>Please disable your canvas blocker extension, or untoggle the <b><i>privacy.resistFingerprinting</i></b> flag of your browser (which blocks access to canvas) to start uploading photos.</p>"+
	    		'<button class="button is-dark" onclick="hideActiveWarningModal();">Close</button>'+
	    	'</div>'+
	    '</div>'+
	  '</div>'+
	'</div>';
	$("body").append(canvasModalHTML);
	setTimeout(function() {
		$("#canvas-blocked-modal").addClass("is-shown");
	}, 10);
}

function hideCanvasBlockedModal () {
	$("#canvas-blocked-modal").removeClass("is-shown");
	setTimeout(function() {
		$("#canvas-blocked-modal").remove();
	}, 1000);
}
