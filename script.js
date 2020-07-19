window.onload = init;

var rMin = 0;
var rMax = 255;
var gMin = 0;
var gMax = 255;
var bMin = 0;
var bMax = 255;

var SCREEN_WIDTH = 900;
var SCREEN_HEIGHT = 600;

const RADIUS = 5;

const RADIUS_SCALE_MIN = 1;
const RADIUS_SCALE_MAX = 1.05;

const NEW_POINTS_MULT = 0.05;

const FALLBACK_COLOR = '#ffffff';

const FRAMES_TO_RECALC = 1;

// The number of circles
const QUANTITY = 2500;

var canvas;
var context;
var points;
var borderPoints;

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
var delaunay;
var delaunayFrameCounter = 0;
var gradientColor = true;

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

    updateBorderPoints();
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
        createNewSinglePoint();
    }
}

function createNewRandomPoint(){
    var x = Math.random() * SCREEN_WIDTH;
    var y = Math.random() * SCREEN_HEIGHT;
    return createNewPointByCoords(
        x, 
        y,
        getColor(x, y)
    );
}

function getRandomInZeroOne() { return (-1 + 2 * Math.random()); }

function createNewPointByCoords(x, y, color, size = RADIUS){
    var pointSpeed = {dx : getRandomInZeroOne() * baseSpeed, dy: getRandomInZeroOne() * baseSpeed};

    var point = {
        position: { x: x, y: y },
        size: size * (1 + Math.random() * (RADIUS_SCALE_MAX - RADIUS_SCALE_MIN)),            
        color: color,
        linesTo: [],
        selected: false,
        speed: pointSpeed    
    };
    return point;
}

function toColorHex(digit, len = 2){
    var ret = digit.toString(16);
    while (ret.length < len){
        ret = '0' + ret;
    }
    return ret;
}

function gerRandomColor(){
    let rDist = rMax - rMin;
    let gDist = gMax - gMin;
    let bDist = bMax - bMin;

    if (rDist == 0 && gDist == 0 && bDist == 0){
        return FALLBACK_COLOR;
    }
    else {
        let r = (Math.random() * rDist + rMin) | 0;
        let g = (Math.random() * gDist + gMin) | 0;
        let b = (Math.random() * bDist + bMin) | 0;
        return '#' + toColorHex(r) + toColorHex(g) + toColorHex(b);
    }
}

function getDistanceColor(x, xMax, y, yMax){

    
    if (rMax == 0 && gMax == 0 && bMax == 0){
        return FALLBACK_COLOR;
    }

    var mX = xMax / 2;
    var xDist = Math.abs(x - mX);
    var xPart = xDist / mX;

    var mY = yMax / 2;
    var yDist = Math.abs(y - mY);
    var yPart = yDist / mY;
    let r = (Math.sqrt((xPart * xPart - yPart * yPart)) * (rMax - rMin) + rMin) | 0;
    let g = ((1 - xPart) * (gMax - gMin) + gMin) | 0;
    let b = ((yPart) * (bMax - bMin) + bMin) | 0;


    let ret = '#' + toColorHex(r) + toColorHex(g) + toColorHex(b);

    return ret;
}

function getColor(x, y) {
    if (gradientColor){
        return getDistanceColor(x, SCREEN_WIDTH, y, SCREEN_HEIGHT);
    }
    else {
        return gerRandomColor();
    }
}

function updatePointColor(point){
    point.color = getColor(point.position.x, point.position.y);
}

function createBorderPoints(pointsOnSide){
    let newBorderPoints = [];
    for(let i = 0; i < pointsOnSide; i++){
        var x = (SCREEN_WIDTH / (pointsOnSide - 1)) * i;
        newBorderPoints.push(createNewPointByCoords(x, 0, getColor(x, 0)));
        newBorderPoints.push(createNewPointByCoords(x, SCREEN_HEIGHT, getColor(x, SCREEN_HEIGHT)));
    }
    
    for(let i = 1; i < (pointsOnSide - 1); i++){
        var y = (SCREEN_HEIGHT / (pointsOnSide - 1)) * i;
        newBorderPoints.push(createNewPointByCoords(0, y, getColor(0, y)));
        newBorderPoints.push(createNewPointByCoords(SCREEN_WIDTH, y, getColor(SCREEN_WIDTH, y)));
    }

    return newBorderPoints;
}

function createNewSinglePoint(){
    var point = createNewRandomPoint();        
    points.push(point);
}

function addNewPoints(){
    var numberOfNewPoints = points.length * NEW_POINTS_MULT;
    if (numberOfNewPoints < 1) numberOfNewPoints = 1;

    for(let i = 0; i < numberOfNewPoints; i++)
    {
        createNewSinglePoint();
    }
}

function popPoints()
{
    var numberOfPoints = points.length * NEW_POINTS_MULT;
    if (numberOfPoints < 1) numberOfPoints = 1;

    for(let i = 0; i < numberOfPoints; i++)
    {
        points.pop();
    }
}

function adjustSpeed(multiplier){
    for (let i = 0, len = points.length; i < len; i++) {
        var point = points[i];
        point.speed.dx *= multiplier;
        point.speed.dy *= multiplier;
    }
}

function updateAllPointsColor(){
    for (let i = 0, len = points.length; i < len; i++) {
        var point = points[i];
        point.color = getColor(point.position.x, point.position.y);
    }
}

function getDistance(x0, x1, y0, y1, r){
    return Math.sqrt((x1-x0)*(x1-x0) + (y1-y0)*(y1-y0));
}

function loop() {
    // Fade out the lines slowly by drawing a rectangle over the entire canvas
    context.fillStyle = 'rgba(0,0,0,' + trailIntensity + ')';
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    updateBorderPoints();
    drawMesh();
    handlePointsFrame();
}

function updateBorderPoints(force = false) {
    var targetSidePoints = (Math.sqrt(points.length) / 2) | 0;
    if (targetSidePoints < 4){
        targetSidePoints = 4;
    }
    var numberOfBorderPoints = targetSidePoints * 2 + (targetSidePoints - 2) * 2;

    if (force || numberOfBorderPoints != borderPoints.length) {
        borderPoints = createBorderPoints(targetSidePoints);
    }
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
    let allPoints = borderPoints.concat(points);
    
    if (delaunayFrameCounter++ == 0){
        delaunay = Delaunator.from(allPoints);
    }
    if (delaunayFrameCounter >= FRAMES_TO_RECALC){
        delaunayFrameCounter = 0;
    }

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
        context.fillStyle = selected ? selectionColor : point1.color;
        context.strokeStyle = selected ? selectionColor : point1.color;
        context.lineWidth = selected ? point1.size / 3 : point1.size / 10;
        context.stroke();
    }

    // the fill color
    if (drawTriangles) {
        context.fillStyle = point1.color;
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
        if (gradientColor) {
            updatePointColor(point);
        }
    }
}

function drawPoint(point){        
    context.beginPath();
    context.fillStyle = point.selected ? selectionColor : point.color;
    context.strokeStyle = point.selected ? selectionColor : point.color;
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
    
    borderPoints = createBorderPoints();
}

function keyPressHandler(e){
    if(e.keyCode == 32){
        addNewPoints();
        return;
    }
    else if (e.keyCode == 13){
        popPoints();
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
        case 'KeyC':
            gradientColor = !gradientColor;
            updateBorderPoints(true);
            updateAllPointsColor();
            break;
        case 'KeyR':
            rMax = rMax == 0 ? 255 : 0;
            updateBorderPoints(true);
            updateAllPointsColor();
            break;
        case 'KeyG':
            gMax = gMax == 0 ? 255 : 0;
            updateBorderPoints(true);
            updateAllPointsColor();
            break;
        case 'KeyB':
            bMax = bMax == 0 ? 255 : 0;
            updateBorderPoints(true);
            updateAllPointsColor();
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