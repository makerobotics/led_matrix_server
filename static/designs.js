const mosquitto = 'mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,'; //"1,0,255,0,0,"';
const PICTURE = 1; // Manual mode. Each pixel is sent by js client
const SEQUENCE = 2; // json object is created for sequence and sent to led matrix controller

var ws;
var canvas;
var ctx;
var canvasWidth;
var canvasHeight;
//var mode = PICTURE;
var mode = SEQUENCE;
var sequence = {name: "mySequence", slides: []};
var SPECTRUM = "SPECTRUM";
var EYE = "EYE";
var FIRE = "FIRE";
var index = 0;
var nbslides = 1;
var readJSONFile = 0;

function makeGrid(numRows, numCols, color) {
    let width = canvasWidth / numCols;
    let height = canvasHeight / numRows;

    ctx.fillStyle = "black";//To clear the canvas
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color || "black"; //I added the last part just in case color is undefined

    for (let i = width; i < canvasWidth; i += width) {
        drawLine(i, 0, i, canvasHeight);
    }

    for (let i = height; i < canvasHeight; i += height) {
        drawLine(0, i, canvasWidth, i);
    }

    function drawLine(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }
}

/* Called by index.html as frame selection was changed */
function selectFrame(){
    mode = SEQUENCE;
    let lastIndex = index;
    index = Number(frameInput.value);

    // Init first slide, only one slide, last slide not validated
    if( ( (index == 1) && (nbslides == 1)) || ( (index == 0) && (nbslides == 1)) /*|| (index == lastIndex)*/ ){
        sequence.slides.push({delay: Number(delayInput.value), pixels:[]});
        console.log("index: "+index+" nbslides: "+nbslides+" lastIndex: "+lastIndex);
    }
    // Save the last frame
    writeFrame(lastIndex);

    // is a new frame?
    if(index >= nbslides) {
        // add a new frame
        sequence.slides.push({delay: Number(delayInput.value), pixels:[]});
        nbslides = index+1;
        nbframes.innerHTML = nbslides + " frames";
        //console.log("Added a slide. NB slides: "+nbslides);
    }
    else{
        // Read current frame from data structure
        getFrame(index);
    }
}

function loadJSONFrame(json_string){
    var obj = JSON.parse(json_string);
    //console.log(obj);
    sequence = obj;
    getFrame(Number(frameInput.value));
    nbslides = Number(sequence.slides.length);
    nbframes.innerHTML = nbslides + " frames";
}

function getFrame(idx){
    //console.log("Index: "+idx);
    clearPixels();
    for (let i = 0; i < sequence.slides[idx].pixels.length; i += 1) {
        let pix = sequence.slides[idx].pixels[i];
        //console.log("Pixel: "+pix);
        let attributes = pix.split(",")
        setPixel(attributes[0], attributes[1], "rgb("+attributes[2]+","+attributes[3]+","+attributes[4]+")");
    }
    delayInput.value = sequence.slides[idx].delay;
    //console.log("Delay: "+sequence.slides[idx].delay);
}

function clearPixels(){
    // clear all pixels before getting lastIndex frame
    for (let i = 0; i < numRows; i += 1) {
        for (let j = 0; j < numCols; j += 1) {
            setPixel(i, j, "black")
        }
    }
}

function setPixel(x, y, color){
    //console.log("x: "+x+" y: "+y+" color: "+color);
    let margin = canvas.getBoundingClientRect();
    //console.log(margin);
    let squareWidth = canvasWidth / numCols;
    //console.log("Sq width: "+squareWidth);
    let squareHeight = canvasHeight / numRows;
    ctx.fillStyle = color || "white";
    ctx.fillRect(x*squareWidth+1, y*squareHeight+1, squareWidth-1, squareHeight-1);
}

function writeFrame(idx){
    // clear frame data
    sequence.slides[idx].pixels = [];
    sequence.slides[idx].delay = delayInput.value;
    for (let i = 0; i < numRows; i += 1) {
        for (let j = 0; j < numCols; j += 1) {
            let pixcolor = getPixelColor(i,j);
            if(pixcolor.data[0]>0 || pixcolor.data[1]>0 || pixcolor.data[2]>0) {
                //console.log("x: "+i," y: ",j," R: ", pixcolor.data[0]," G: ", pixcolor.data[1]," B: ", pixcolor.data[2]);
                sequence.slides[idx].pixels.push(i+','+j+','+pixcolor.data[0]+','+pixcolor.data[1]+','+pixcolor.data[2]+',');
            }
        }
    }
    textOutput.value = JSON.stringify(sequence);
    //ws.send(JSON.stringify(sequence));
    //console.log(JSON.stringify(sequence));
}

function getPixelColor(x, y){
    let width = canvasWidth / numCols;
    let height = canvasHeight / numRows;

    return ctx.getImageData(x*width+1, y*height+1, 1, 1);
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function generateText(){
    let red = hexToRgb(colorInput.value).r;
    let green = hexToRgb(colorInput.value).g;
    let blue = hexToRgb(colorInput.value).b;
    let textcommand = {text: textScroll.value, delay: Number(delayInput.value), fg:red+','+green+','+blue+','}
    textOutput.value = JSON.stringify(textcommand);
    ws.send(JSON.stringify(textcommand));
}

function readFrame(){
    loadJSONFrame(textOutput.value);
}

function sendDirectCommand(){
    ws.send(textOutput.value);
}

function changeMode(){
    if(modeSelect.value != "void") ws.send(modeSelect.value);
    //if(modeSelect.value == "Spectrum0") ws.send(SPECTRUM);
    //else if(modeSelect.value == "Eye") ws.send(EYE);
    //else if(modeSelect.value == "Fire") ws.send(FIRE);
}

function generateFrame(){
    let width = canvasWidth / numCols;
    let height = canvasHeight / numRows;

    function echoColor(x, y, i, j){

        var imgData = ctx.getImageData(x, y, 1, 1);

        red = imgData.data[0];
        green = imgData.data[1];
        blue = imgData.data[2];
        //alpha = imgData.data[3];
        if(red>0 || green>0 || blue>0) {
            //console.log(i,",",j,",",red,",",green,",",blue,",");
            textOutput.value += mosquitto+i+','+j+','+red+','+green+','+blue+',"\n';
            ws.send('SET,'+i+','+j+','+red+','+green+','+blue+',');
        }
    }
    /* PICTURE mode */
    if(mode == PICTURE){
        /* Send image to led matrix control */
        ws.send('CLR');
        textOutput.value = '';
        for (let i = 0; i < numRows; i += 1) {
            for (let j = 0; j < numCols; j += 1) {
                echoColor(i*width+1, j*height+1, i, j);
            }
        }
        ws.send('SHOW');
    }
    /* SEQUENCE mode */
    else {
        /* Handle json file import */
        if(readJSONFile != 1){
            // Save the last frame
            selectFrame();
        }
        else {
            readJSONFile = 0;
            asText.value = "";
        }
        // Send to python server
        ws.send(textOutput.value);
        //ws.send(JSON.stringify(sequence));
    }
}

function init(){
    /* Set up the websocket client */
    WebSocketTest();

    /* Set up global variables */
    canvas = document.getElementById("pixelCanvas");
    ctx = canvas.getContext("2d");
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    rowsInput = document.getElementById("rows-input");
    colsInput = document.getElementById("cols-input");
    submitBtn = document.getElementById("submit-btn");
    colorInput = document.getElementById("color-input");
    textOutput = document.getElementById("TEXTBOX_ID");
    textScroll = document.getElementById("TEXT_ID");
    frameInput = document.getElementById("frame");
    delayInput = document.getElementById("delay");
    asText = document.getElementById('asText');
    nbframes = document.getElementById('nbframes');
    modeSelect = document.getElementById('modes');
    numRows = 8;
    numCols = 8;

    textOutput.value = "";
    makeGrid(numRows, numCols, "gray");


    asText.addEventListener('change', function(e) {
        const file = asText.files[0];
        const textType = /application.*/;

        if (file.type.match(textType)) {
            const reader = new FileReader();

            reader.onload = function(e) {
                textOutput.value = reader.result;
                readJSONFile = 1;
                loadJSONFrame(textOutput.value);
            }

            reader.readAsText(file);
        } else {
            textOutput.value = "Dateityp nicht unterstützt";
        }
    });


    // When size is submitted by the user, call makeGrid()
    /*submitBtn.onclick = function(event){
        event.preventDefault();

        numRows = Number(rowsInput.value);
        numCols = Number(colsInput.value);
        makeGrid(numRows, numCols, "gray");
    };*/

    canvas.onclick = function(event){
        event.preventDefault();

        let margin = this.getBoundingClientRect();
        let x = event.clientX - margin.left;
        let y = event.clientY - margin.top;

        drawSquare(x, y, colorInput.value); //I'm tired of red
    }

    function drawSquare(x, y, color){
        ctx.fillStyle = color || "white";

        let squareWidth = canvasWidth / numCols;
        let squareHeight = canvasHeight / numRows;

        x = findIndex(x, squareWidth);
        y = findIndex(y, squareHeight);

        let onVerticalAxis = x === 0 || x === canvasWidth - squareWidth + 1;
        let onHorizonalAxis = y === 0 || y === canvasHeight - squareHeight + 2;

        squareWidth -= (onVerticalAxis) ? 1 : 2;
        squareHeight -= (onHorizonalAxis) ? 1 : 2;

        ctx.fillRect(x, y, squareWidth, squareHeight);

        function findIndex(num, size) {
            num = num - (num % size);
            return (num === 0) ? num : num + 1; //If the index is zero, I want to add one so that doesn't go into the edge of the canvas
        }
    }
}

function WebSocketTest() {

    if ("WebSocket" in window) {

       ws = new WebSocket('ws://' + location.host+"/websocket");

       ws.onopen = function() {
          console.log('Connection opened');
          document.getElementById("status").innerHTML = "online";
          document.getElementById("status").style.color = "#00ff00";
       };

       ws.onmessage = function (evt) {
          console.log("Messages: "+evt.data);
       };

       ws.onerror = function(event) {
          console.error("WebSocket error observed:", event);
          console.log('Error: '+event.data);
          document.getElementById("status").innerHTML = "error";
       };

       ws.onclose = function() {
          console.log('Connection closed');
          document.getElementById("status").innerHTML = "offline";
          document.getElementById("status").style.color = "#ff0000";
       };
    } else {
       // The browser doesn't support WebSocket
       alert("WebSocket NOT supported by your Browser!");
    }
}
