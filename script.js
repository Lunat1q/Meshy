window.onload = init;

let rMin = 0;
let rMax = 255;
let gMin = 0;
let gMax = 255;
let bMin = 0;
let bMax = 255;

let SCREEN_WIDTH = 900;
let SCREEN_HEIGHT = 600;

const TARGET_DPS = 30;

const RADIUS = 5;

const RADIUS_SCALE_MIN = 1;
const RADIUS_SCALE_MAX = 1.05;

const NEW_POINTS_MULT = 0.05;

const FALLBACK_COLOR = '#ffffff';

const FRAMES_TO_RECALC = 1;

// The number of circles
const QUANTITY = 2500;

const modes = {
    RANDOM: "random",
    GRADIENT: "gradient",
    CIRCLES: "circles"
}

let canvas;
let context;
let points;
let borderPoints;

let mouseX = (window.innerWidth - SCREEN_WIDTH);
let mouseY = (window.innerHeight - SCREEN_HEIGHT);
let mouseDownX;
let mouseDownY;
let mouseIsDown = false;
let selectedFound = false;
let updateStats = false;
let selectionColor = 'rgba(255,255,255,1)';
let baseSpeed = 0.5;
let animate = true;
let drawTriangles = false;
let drawEdgeLines = true;
let drawPoints = false;
let trailIntensity = 0.1;
let delaunay;
let delaunayFrameCounter = 0;
let mode = modes.GRADIENT;

let fpsFilterStrength = 20;
let frameTime = 0;
let lastLoop;
let thisLoop;
let isMobileRes = false;
let intervalId;

function init() {
    canvas = document.getElementById('main');
    isMobileRes = isMobile();

    if (canvas && canvas.getContext) {
        context = canvas.getContext("2d", { alpha: false });

        if (!isMobileRes) {
            // Register event listeners
            document.addEventListener('mousemove', documentMouseMoveHandler, false);
            document.addEventListener('mousedown', documentMouseDownHandler, false);
            document.addEventListener('mouseup', documentMouseUpHandler, false);
            window.addEventListener('resize', windowResizeHandler, false);
            document.addEventListener('keypress', keyPressHandler, false);
        }
        else {
            document.addEventListener('touchend', detectDoubleTap(500), { passive: false });
            document.addEventListener('doubletap', doubleTapHandler);
        }
        windowResizeHandler();
        createPoints();
        initBullets();

        setInterval(loop, 1000 / TARGET_DPS);
    }

    document.getElementById("help").style.display = !isMobileRes ? "block" : "none";
    document.getElementById("help-mobile").style.display = isMobileRes ? "block" : "none";

    startFpsUpdate();

    updateBorderPoints();
}

document.oncontextmenu = function (e) {
    if (!isMobile()) {
        stopEvent(e);
        toggleHelp();
    }
}

function mousedownfunc(func) {
    intervalId = setInterval(func, 50);
}

function mouseupfunc() {
    clearInterval(intervalId);
}

function doubleTapHandler(e) {
    stopEvent(e);
    toggleHelp();
}

function detectDoubleTap(doubleTapMs) {
    let timeout, lastTap = 0
    return function detectDoubleTap(event) {
        const currentTime = new Date().getTime()
        const tapLength = currentTime - lastTap
        if (0 < tapLength && tapLength < doubleTapMs) {
            event.preventDefault()
            const doubleTap = new CustomEvent("doubletap", {
                bubbles: true,
                detail: event
            })
            event.target.dispatchEvent(doubleTap)
        }
        lastTap = currentTime
    }
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function stopEvent(event) {
    if (event.preventDefault != undefined)
        event.preventDefault();
    if (event.stopPropagation != undefined)
        event.stopPropagation();
}

function initBullets() {
    points = [];
}

function createPoints() {
    points = [];

    for (let i = 0; i < QUANTITY; i++) {
        createNewSinglePoint();
    }
}

function createNewRandomPoint() {
    let x = Math.random() * SCREEN_WIDTH;
    let y = Math.random() * SCREEN_HEIGHT;
    return createNewPointByCoords(
        x,
        y,
        getColor(x, y)
    );
}

function toggleHelp() {
    var x = document.getElementById(isMobileRes ? "help-mobile" : "help");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}

function getRandomInZeroOne() { return (-1 + 2 * Math.random()); }

function createNewPointByCoords(x, y, color, size = RADIUS) {
    let pointSpeed = { dx: getRandomInZeroOne() * baseSpeed, dy: getRandomInZeroOne() * baseSpeed };

    let point = {
        position: { x: x, y: y },
        size: size * (1 + Math.random() * (RADIUS_SCALE_MAX - RADIUS_SCALE_MIN)),
        color: color,
        linesTo: [],
        selected: false,
        speed: pointSpeed
    };
    return point;
}

function toColorHex(digit, len = 2) {
    let ret = digit.toString(16);
    while (ret.length < len) {
        ret = '0' + ret;
    }
    return ret;
}

function gerRandomColor() {
    let rDist = rMax - rMin;
    let gDist = gMax - gMin;
    let bDist = bMax - bMin;

    if (rDist == 0 && gDist == 0 && bDist == 0) {
        return FALLBACK_COLOR;
    }
    else {
        let r = (Math.random() * rDist + rMin) | 0;
        let g = (Math.random() * gDist + gMin) | 0;
        let b = (Math.random() * bDist + bMin) | 0;
        return '#' + toColorHex(r) + toColorHex(g) + toColorHex(b);
    }
}

function getHexColorFromRgb(r, g, b) { return '#' + toColorHex(r) + toColorHex(g) + toColorHex(b); }

function getGradientColor(x, xMax, y, yMax) {
    if (rMax == 0 && gMax == 0 && bMax == 0) {
        return FALLBACK_COLOR;
    }

    let mX = xMax / 2;
    let xDist = Math.abs(x - mX);
    let xPart = xDist / mX;

    let mY = yMax / 2;
    let yDist = Math.abs(y - mY);
    let yPart = yDist / mY;
    let r = (Math.sqrt((xPart * xPart - yPart * yPart)) * (rMax - rMin) + rMin) | 0;
    let g = ((1 - xPart) * (gMax - gMin) + gMin) | 0;
    let b = ((yPart) * (bMax - bMin) + bMin) | 0;

    return getHexColorFromRgb(r, g, b);;
}

let frameCount = 0;
function handleColorAnimation() {
    if (!animate) {
        return;
    }
    frameCount++;
    switch (mode) {
        case modes.GRADIENT:
            break;
        case modes.RANDOM:
            break;
        case modes.CIRCLES:
            if (frameCount >= 3) {
                if (circlesUp) {
                    circlesCount += 0.1;
                }
                else {
                    circlesCount -= 0.1;
                }
                frameCount = 0;
            }

            let hitRange = false;
            if (circlesUp && circlesCount >= 15) {
                circlesUp = false;
                hitRange = true;
            }
            else if (!circlesUp && circlesCount <= 0.5) {
                circlesUp = true;
                hitRange = true;
            }

            if (hitRange) {
                centerMoveX = Math.random() > 0.5;
                centerMoveY = Math.random() > 0.5;
                if (centerMoveX && Math.random() > 0.8) {
                    centerMoveXUp = !centerMoveXUp;
                }
                if (centerMoveY && Math.random() > 0.8) {
                    centerMoveYUp = !centerMoveYUp;
                }
            }
            const COLOR_MULT = 1.0004;

            if (centerMoveX) {
                if (centerMoveXUp) {
                    centerPositionX *= COLOR_MULT;
                }
                else {
                    centerPositionX /= COLOR_MULT;
                }
                if (centerPositionX > 20) {
                    centerMoveXUp = false;
                }
                else if (centerPositionX < 1.1) {
                    centerMoveXUp = true;
                }
            }
            if (centerMoveY) {
                if (centerMoveYUp) {
                    cetnerPositionY *= COLOR_MULT;
                }
                else {
                    cetnerPositionY /= COLOR_MULT;
                }

                if (cetnerPositionY > 20) {
                    centerMoveYUp = false;
                }
                else if (cetnerPositionY < 1.1) {
                    centerMoveYUp = true;
                }
            }

            break;
    }
}

let circlesUp = true;
let circlesCount = 2.0;
let centerPositionX = 2;
let cetnerPositionY = 2;
let centerMoveX = false;
let centerMoveXUp = false;
let centerMoveY = false;
let centerMoveYUp = false;

function getColorForCircle(x, xMax, y, yMax) {
    if (rMax == 0 && gMax == 0 && bMax == 0) {
        return FALLBACK_COLOR;
    }

    let cX = xMax / centerPositionX;
    let cY = yMax / cetnerPositionY;
    let xDist = Math.abs(x - cX);
    let yDist = Math.abs(y - cY);

    let dist = Math.sqrt(xDist * xDist + yDist * yDist);

    let maxDist = Math.sqrt(cX * cX + cY * cY);

    let circleStep = maxDist / circlesCount;

    var stepDist = (dist % circleStep) / circleStep;
    var step = ((dist / circleStep) | 0) % 3;

    let r = 0;
    let g = 0;
    let b = 0;
    switch (step) {
        case 0:
            g = (1 - stepDist) * (gMax - gMin) + gMin;
            r = stepDist * (rMax - rMin) + rMin;
            break;
        case 1:
            r = (1 - stepDist) * (rMax - rMin) + rMin;
            b = stepDist * (bMax - bMin) + bMin;
            break;
        case 2:
            b = (1 - stepDist) * (bMax - bMin) + bMin;
            g = (stepDist) * (gMax - gMin) + gMin;
            break;
    }

    return getHexColorFromRgb(r | 0, g | 0, b | 0);
}

function getColor(x, y) {
    switch (mode) {
        case modes.GRADIENT:
            return getGradientColor(x, SCREEN_WIDTH, y, SCREEN_HEIGHT);
        case modes.RANDOM:
            return gerRandomColor();
        case modes.CIRCLES:
            return getColorForCircle(x, SCREEN_WIDTH, y, SCREEN_HEIGHT);
    }
}

function updatePointColor(point) {
    point.color = getColor(point.position.x, point.position.y);
}

function createBorderPoints(pointsOnSide) {
    let newBorderPoints = [];
    for (let i = 0; i < pointsOnSide; i++) {
        let x = (SCREEN_WIDTH / (pointsOnSide - 1)) * i;
        newBorderPoints.push(createNewPointByCoords(x, 0, getColor(x, 0)));
        newBorderPoints.push(createNewPointByCoords(x, SCREEN_HEIGHT, getColor(x, SCREEN_HEIGHT)));
    }

    for (let i = 1; i < (pointsOnSide - 1); i++) {
        let y = (SCREEN_HEIGHT / (pointsOnSide - 1)) * i;
        newBorderPoints.push(createNewPointByCoords(0, y, getColor(0, y)));
        newBorderPoints.push(createNewPointByCoords(SCREEN_WIDTH, y, getColor(SCREEN_WIDTH, y)));
    }

    return newBorderPoints;
}

function createNewSinglePoint() {
    let point = createNewRandomPoint();
    points.push(point);
}

function addNewPoints() {
    let numberOfNewPoints = points.length * NEW_POINTS_MULT;
    if (numberOfNewPoints < 1) numberOfNewPoints = 1;

    for (let i = 0; i < numberOfNewPoints; i++) {
        createNewSinglePoint();
    }
    refreshPointsStat();
}

function refreshPointsStat() {
    var numOfDots = document.getElementById("numberOfDots");
    if (updateStats) {
        numOfDots.innerText = points.length;
    }
}

function popPoints() {
    if (points.length == 1) {
        return;
    }
    let numberOfPoints = points.length * NEW_POINTS_MULT;
    if (numberOfPoints < 1) numberOfPoints = 1;

    for (let i = 0; i < numberOfPoints; i++) {
        points.pop();
    }
    refreshPointsStat();
}

function adjustSpeed(multiplier) {
    for (let i = 0, len = points.length; i < len; i++) {
        let point = points[i];
        point.speed.dx *= multiplier;
        point.speed.dy *= multiplier;
    }
}

function updateAllPointsColor() {
    for (let i = 0, len = points.length; i < len; i++) {
        let point = points[i];
        point.color = getColor(point.position.x, point.position.y);
    }
}

function getDistance(x0, x1, y0, y1, r) {
    return Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
}

function loop() {
    // Fade out the lines slowly by drawing a rectangle over the entire canvas
    context.fillStyle = 'rgba(0,0,0,' + trailIntensity + ')';
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    updateBorderPoints();
    drawMesh();
    handlePointsFrame();

    handleColorAnimation();
    calcFps();
}

function calcFps() {
    if (updateStats) {
        var thisFrameTime = (thisLoop = new Date) - lastLoop;
        frameTime += (thisFrameTime - frameTime) / fpsFilterStrength;
        lastLoop = thisLoop;
    }
}

function startFpsUpdate() {
    var fpsOut = document.getElementById('fps');
    setInterval(
        function () {
            if (updateStats) {
                fpsOut.innerHTML = (1000 / frameTime).toFixed(1);
            }
        },
        3000);

}

function updateBorderPoints(force = false) {
    let targetSidePoints = (Math.sqrt(points.length) / 2) | 0;
    if (targetSidePoints < 4) {
        targetSidePoints = 4;
    }
    let numberOfBorderPoints = targetSidePoints * 2 + (targetSidePoints - 2) * 2;

    if (force || numberOfBorderPoints != borderPoints.length) {
        borderPoints = createBorderPoints(targetSidePoints);
    }
}

function nextHalfedge(e) { return (e % 3 === 2) ? e - 2 : e + 1; }
function prevHalfedge(e) { return (e % 3 === 0) ? e + 2 : e - 1; }

function edgesOfTriangle(t) { return [3 * t, 3 * t + 1, 3 * t + 2]; }
function triangleOfEdge(e) { return Math.floor(e / 3); }

function pointsOfTriangle(delaunay, t) {
    return edgesOfTriangle(t)
        .map(e => delaunay.triangles[e]);
}

function drawMesh() {
    let allPoints = borderPoints.concat(points);

    if (delaunayFrameCounter++ == 0) {
        delaunay = Delaunator.from(allPoints);
    }
    if (delaunayFrameCounter >= FRAMES_TO_RECALC) {
        delaunayFrameCounter = 0;
    }

    for (let t = 0; t < delaunay.triangles.length / 3; t++) {
        drawTriangle(t, pointsOfTriangle(delaunay, t).map(p => allPoints[p]));
    }
}

function drawTriangle(idx, points) {
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
        // context.fillStyle = selected ? selectionColor : point1.color; //not really needed
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

function isMouseOver(point) {
    return getDistance(point.position.x, mouseDownX, point.position.y, mouseDownY) < point.size
}

function animatePoint(point) {
    point.position.x += point.speed.dx;
    point.position.y += point.speed.dy;

    if (point.position.x < 0 || point.position.x > SCREEN_WIDTH) {
        point.speed.dx *= -1;
    }
    if (point.position.y < 0 || point.position.y > SCREEN_HEIGHT) {
        point.speed.dy *= -1;
    }
}

function handlePointsFrame() {

    if (points.length == 0) {
        createPoints();
    }

    for (let i = 0, len = points.length; i < len; i++) {
        let point = points[i];

        if (mouseIsDown && !selectedFound) {
            if (isMouseOver(point)) {
                point.selected = true;
                selectedFound = true;
            }
        }
        else if (!mouseIsDown && point.selected) {
            point.selected = false;
            selectedFound = false;
        }

        if (point.selected) {
            point.position.x = mouseX;
            point.position.y = mouseY;
        }
        else if (animate) {
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

        if (drawPoints) {
            drawPoint(point);
        }
        if (mode != modes.RANDOM) {
            updatePointColor(point);
        }
    }
}

function drawPoint(point) {
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
    selectedFound = false;
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

function toggleStatsWindow() {
    var x = document.getElementById("stats");
    if (x.style.display === "none") {
        x.style.display = "block";
        updateStats = true;
        lastLoop = new Date;
        thisLoop = null;
        frameTime = 0;
        refreshPointsStat();
    } else {
        x.style.display = "none";
        updateStats = false;
    }
}

function toggleLines() {
    drawEdgeLines = !drawEdgeLines;
}

function toggleTriangles() {
    drawTriangles = !drawTriangles;
}

function togglePoints() {
    drawPoints = !drawPoints;
}

function toggleRed() {
    rMax = rMax == 0 ? 255 : 0;
    updateBorderPoints(true);
    updateAllPointsColor();
}

function toggleGreen() {
    gMax = gMax == 0 ? 255 : 0;
    updateBorderPoints(true);
    updateAllPointsColor();
}

function toggleBlue() {
    bMax = bMax == 0 ? 255 : 0;
    updateBorderPoints(true);
    updateAllPointsColor();
}

function toggleGradientMode() {
    mode = modes.GRADIENT;
    updateBorderPoints(true);
    updateAllPointsColor();
}

function toggleRandomMode() {
    mode = modes.RANDOM;
    updateBorderPoints(true);
    updateAllPointsColor();
}

function toggleCirclesMode() {
    mode = modes.CIRCLES;
    updateBorderPoints(true);
    updateAllPointsColor();
}

function toggleAnimation() {
    animate = !animate;
}

function increaseSpeed() {
    baseSpeed *= 1.1;
    adjustSpeed(1.1);
}

function decreaseSpeed() {
    baseSpeed *= 1 / 1.1;
    adjustSpeed(1 / 1.1);
}

function increaseTrail() {
    trailIntensity *= 1.1;
    if (trailIntensity > 1) {
        trailIntensity = 1;
    }
}

function decreaseTrail() {
    trailIntensity *= 1 / 1.1;
    if (trailIntensity < 0.005) {
        trailIntensity = 0.005;
    }
}


function keyPressHandler(e) {
    if (e.keyCode == 32) {
        addNewPoints();
        return;
    }
    else if (e.keyCode == 13) {
        popPoints();
        return;
    }

    switch (e.code) {
        case 'KeyS':
            toggleStatsWindow();
            break;
        case 'KeyA':
            toggleAnimation();
            break;
        case 'Equal':
            increaseSpeed();
            break;
        case 'Minus':
            decreaseSpeed();
            break;
        case 'KeyT':
            toggleTriangles();
            break;
        case 'KeyL':
            toggleLines();
            break;
        case 'KeyP':
            togglePoints();
            break;
        case 'KeyR':
            toggleRed();
            break;
        case 'KeyG':
            toggleGreen();
            break;
        case 'KeyB':
            toggleBlue();
            break;
        case 'BracketRight':
            decreaseTrail();
            break;
        case 'BracketLeft':
            increaseTrail();
            break;
        case 'Digit1':
            toggleGradientMode();
            break;
        case 'Digit2':
            toggleRandomMode();
            break;
        case 'Digit3':
            toggleCirclesMode();
            break;
        default:
            break;
    }
}
