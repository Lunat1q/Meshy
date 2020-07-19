/*
---Hotkeys---

General:
Spacebar = add new point
Enter = pop point

Rendering settings:
L = toggle lines
T = toggle triangles
P = toggle points

Animation:
A = toggle animation
{ (Left bracket) = increase trail time animation
} (Left bracket) = decrease trail time animation
+ = increase points speed
- = decrease points speed

*/

window.onload = init;

const rMin = 0;
const rMax = 0;
const gMin = 100;
const gMax = 200;
const bMin = 100;
const bMax = 200;

var SCREEN_WIDTH = 900;
var SCREEN_HEIGHT = 600;

const RADIUS = 5;

const RADIUS_SCALE_MIN = 1;
const RADIUS_SCALE_MAX = 1.05;

// The number of circles
const QUANTITY = 2500;

var canvas;
var context;
var points;

var mouseX = (window.innerWidth - SCREEN_WIDTH);
var mouseY = (window.innerHeight - SCREEN_HEIGHT);
var mouseDownX;
var mouseDownY;
var mouseIsDown = false;
var selectedFound = false;
var selectionColor = 'rgba(255,255,255,1)';
var baseSpeed = 0.5;
var animate = true;
var drawTriangles = false;
var drawEdgeLines = true;
var drawPoints = true;
var trailIntensity = 0.1;

function init(){
    canvas = document.getElementById('main');

    if (canvas && canvas.getContext) {
        context = canvas.getContext('2d');
        
        // Register event listeners
        document.addEventListener('mousemove', documentMouseMoveHandler, false);
        document.addEventListener('mousedown', documentMouseDownHandler, false);
        document.addEventListener('mouseup', documentMouseUpHandler, false);
        window.addEventListener('resize', windowResizeHandler, false);
        document.addEventListener('keypress', keyPressHandler, false);          
        
        windowResizeHandler();
        createPoints();      
        initBullets();  
        
        setInterval( loop, 1000 / 30 );
    }
}

document.oncontextmenu = function (e) {
    var evt = new Object({ keyCode: 93 });
    stopEvent(e);
}
function stopEvent(event) {
    if (event.preventDefault != undefined)
        event.preventDefault();
    if (event.stopPropagation != undefined)
        event.stopPropagation();
}

function initBullets(){
    points = [];
}

function createPoints() {
    points = [];
    
    for (var i = 0; i < QUANTITY; i++) {
        addNewPoint();
    }
}

function createNewRandomPoint(){
    return createNewPointByCoords(
        Math.random() * SCREEN_WIDTH, 
        Math.random() * SCREEN_HEIGHT,
        getSequentialColor(Math.random(), 1)
    );
}

function getRandomInZeroOne() { return (-1 + 2 * Math.random()); }

function createNewPointByCoords(x, y, color){
    var pointSpeed = {dx : getRandomInZeroOne() * baseSpeed, dy: getRandomInZeroOne() * baseSpeed};

    var point = {
        position: { x: x, y: y },
        size: RADIUS * (1 + Math.random() * (RADIUS_SCALE_MAX - RADIUS_SCALE_MIN)),            
        fillColor: color,
        linesTo: [],
        selected: false,
        speed: pointSpeed    
    };
    return point;
}

function toColorHex(digit){
    if (digit < 16){
        return '0' + digit.toString(16);
    }
    return digit.toString(16);
}

function getSequentialColor(idx, maxIdx){
    let r = ((idx / maxIdx) * (rMax - rMin) + rMin) | 0;
    let g = ((idx / maxIdx) * (gMax - gMin) + gMin) | 0;
    let b = ((idx / maxIdx) * (bMax - bMin) + bMin) | 0;
    let ret = '#' + toColorHex(r) + toColorHex(g) + toColorHex(b);

    return ret;
}

function createBorderPoints(){
    const numberOfBorderPoints = 12;
    let borderPoints = [];
    var pIdx = 0;
    for(let i = 0; i < 4; i++){
        var x = (SCREEN_WIDTH / 3) * i;
        borderPoints.push(createNewPointByCoords(x, 0, getSequentialColor(pIdx++, numberOfBorderPoints)));
        borderPoints.push(createNewPointByCoords(x, SCREEN_HEIGHT, getSequentialColor(pIdx++, numberOfBorderPoints)));
    }
    
    for(let i = 1; i < 3; i++){
        var y = (SCREEN_HEIGHT / 3) * i;
        borderPoints.push(createNewPointByCoords(0, y, getSequentialColor(pIdx++, numberOfBorderPoints)));
        borderPoints.push(createNewPointByCoords(SCREEN_WIDTH, y, getSequentialColor(pIdx++, numberOfBorderPoints)));
    }

    return borderPoints;
}

function addNewPoint(){
    var point = createNewRandomPoint();        
    points.push( point );
}

function adjustSpeed(multiplier){
    for (let i = 0, len = points.length; i < len; i++) {
        var point = points[i];
        point.speed.dx *= multiplier;
        point.speed.dy *= multiplier;
    }
}

function getDistance(x0, x1, y0, y1, r){
    return Math.sqrt((x1-x0)*(x1-x0) + (y1-y0)*(y1-y0));
}

function loop() {
    // Fade out the lines slowly by drawing a rectangle over the entire canvas
    context.fillStyle = 'rgba(0,0,0,' + trailIntensity + ')';
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    drawMesh();
    handlePointsFrame();
}

function nextHalfedge(e) { return (e % 3 === 2) ? e - 2 : e + 1; }
function prevHalfedge(e) { return (e % 3 === 0) ? e + 2 : e - 1; }

function edgesOfTriangle(t) { return [3 * t, 3 * t + 1, 3 * t + 2]; }
function triangleOfEdge(e)  { return Math.floor(e / 3); }

function pointsOfTriangle(delaunay, t) {
    return edgesOfTriangle(t)
        .map(e => delaunay.triangles[e]);
}

function drawMesh(){
    let allPoints = createBorderPoints().concat(points);
    //let allPoints = points;
    let delaunay = Delaunator.from(allPoints);

    for (let t = 0; t < delaunay.triangles.length / 3; t++) {
        drawTriangle(t, pointsOfTriangle(delaunay, t).map(p => allPoints[p]));
    }
}

function drawTriangle(idx, points){
    point1 = points[0];
    point2 = points[1];
    point3 = points[2];

    let selected = point1.selected || point2.selected || point3.selected;

    // the triangle
    context.beginPath();
    context.moveTo(point1.position.x, point1.position.y);
    context.lineTo(point2.position.x, point2.position.y);
    context.lineTo(point3.position.x, point3.position.y);
    context.closePath();

    if (drawEdgeLines) {
        // the outline
        context.fillStyle = selected ? selectionColor : point1.fillColor;
        context.strokeStyle = selected ? selectionColor : point1.fillColor;
        context.lineWidth = selected ? point1.size : point1.size / 10;
        context.stroke();
    }

    // the fill color
    if (drawTriangles) {
        context.fillStyle = point1.fillColor;
        context.fill();
    }
}

function isMouseOver(point){
    return getDistance(point.position.x, mouseDownX, point.position.y, mouseDownY) < point.size
}

function animatePoint(point){
    point.position.x += point.speed.dx;
    point.position.y += point.speed.dy;

    if (point.position.x < 0 || point.position.x > SCREEN_WIDTH){
        point.speed.dx *= -1;
    }
    if (point.position.y < 0 || point.position.y > SCREEN_HEIGHT){
        point.speed.dy *= -1;
    }
}

function handlePointsFrame(){

    if (points.length == 0){
        createPoints();
    }

    for (let i = 0, len = points.length; i < len; i++) {
        var point = points[i];
        
        if (mouseIsDown && !selectedFound) {
            if (isMouseOver(point)){
                point.selected = true;
                selectedFound = true;
            }
        }
        else if(!mouseIsDown && point.selected){
            point.selected = false;
            selectedFound = false;
        }

        if (point.selected){
            point.position.x = mouseX;
            point.position.y = mouseY;
        }
        else if (animate)
        {
            animatePoint(point);
        }

        if (point.position.x < 0) {
            point.position.x = 0;
        }
        else if (point.position.x > SCREEN_WIDTH) {
            point.position.x = SCREEN_WIDTH;
        }
        if (point.position.y < 0) {
            point.position.y = 0;
        }
        else if (point.position.y > SCREEN_HEIGHT) {
            point.position.y = SCREEN_HEIGHT;
        }
        if (drawPoints){
            drawPoint(point);
        }
    }
}

function drawPoint(point){        
    context.beginPath();
    context.fillStyle = point.selected ? selectionColor : point.fillColor;
    context.strokeStyle = point.selected ? selectionColor : point.fillColor;
    context.lineWidth = point.size;
    context.moveTo(point.position.x, point.position.y);
    context.lineTo(point.position.x, point.position.y);
    context.stroke();
    context.arc(point.position.x, point.position.y, point.size / 2, 0, Math.PI * 2, true);
    context.fill();
}

// Mouse and hotkeys handling

function documentMouseMoveHandler(event) {
    mouseX = event.clientX - (window.innerWidth - SCREEN_WIDTH) * .5;
    mouseY = event.clientY - (window.innerHeight - SCREEN_HEIGHT) * .5;
}

function documentMouseDownHandler(event) {
    mouseIsDown = true;
    mouseDownX = mouseX;
    mouseDownY = mouseY;
}

function documentMouseUpHandler(event) {
    mouseIsDown = false;
}

function windowResizeHandler() {
    SCREEN_WIDTH = window.innerWidth;
    SCREEN_HEIGHT = window.innerHeight;
    
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
    
    canvas.style.position = 'absolute';
    canvas.style.left = (window.innerWidth - SCREEN_WIDTH) * .5 + 'px';
    canvas.style.top = (window.innerHeight - SCREEN_HEIGHT) * .5 + 'px';
}

function keyPressHandler(e){
    if(e.keyCode == 32){
        addNewPoint();
        return;
    }
    else if (e.keyCode == 13){
        points.pop();
        return;
    }

    switch (e.code) {
        case 'KeyA':
            animate = !animate;
            break;
        case 'Equal':
            baseSpeed *= 1.1;
            adjustSpeed(1.1);
            break;
        case 'Minus':
            baseSpeed *= 1 / 1.1;
            adjustSpeed(1 / 1.1);
            break;
        case 'KeyT':
            drawTriangles = !drawTriangles;
            break;
        case 'KeyL':
            drawEdgeLines = !drawEdgeLines;
            break;
        case 'KeyP':
            drawPoints = !drawPoints;
            break;
        case 'BracketRight':
            trailIntensity *= 1.1;
            if (trailIntensity > 1){
                trailIntensity = 1;
            }
            break;
        case 'BracketLeft':
            trailIntensity *= 1 / 1.1;
            if (trailIntensity < 0.005){
                trailIntensity = 0.005;
            }
            break;
        default:
            break;
    }
}