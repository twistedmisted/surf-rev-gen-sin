'use strict';

class Point {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    transformVector() {
        return [this.x, this.y, this.z];
    }
}

class SurfaceData {
    constructor(vertexList, normalList) {
        this.vertexList = vertexList;
        this.normalList = normalList;
    }
}

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let target = [0, 0, 10];
let up = [0, 1, 0];

let parameters = {};

let spotlightAngle;
let spotlightRotation;

const maxAngle = 2 * Math.PI;

function initParameters() {
    parameters = {
        a: 10,
        b: 4,
        zStep: 0.05,
        angleStep: 10,
        ka: 1.0,
        kd: 1.0,
        ks: 1.0,
        shininess: 40.0,
        lightPostionX: 0,
        lightPostionY: 0,
        lightPostionZ: -1,
        spotlightRotationX: 0,
        spotlightRotationY: 0,
        innerLimit: 10,
        outerLimit: 20
    };

    for (let key in parameters) {
        document.getElementById(key).value = parameters[key];
    }
}

// Lambda functions to calculate vertex of 'Surface of Revolution of a "Pear"'
const X = (rZ, angle) => rZ * Math.sin(angle);
const Y = (rZ, angle) => rZ * Math.cos(angle);
const RZ = (z) => (z * Math.sqrt(z * (parameters.a - z))) / parameters.b

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.verticesLength = 0;
    
    this.BufferData = function(surfData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surfData.vertexList), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surfData.normalList), gl.STREAM_DRAW);

        this.verticesLength = surfData.vertexList.length / 3;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
   
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.verticesLength);
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;
    this.iNormalMatrix = -1;

    // Color parameters
    this.iAmbientColor = -1;
    this.iDiffuseColor = -1;
    this.iSpecularColor = -1;
    this.iShininess = -1;

    this.Ka = -1;
    this.Kd = -1;
    this.Ks = -1;

    // Light parameters
    this.iLightPos = -1;
    this.spotlightAngle = -1;
    this.iLightDirection = -1;
    this.iInnerLimit = -1;
    this.iOuterLimit = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


/* Draws a 'Surface of Revolution "Pear"' */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.orthographic(-20, 20, -20, 20, -20, 20);
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = modelView;
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    const modelviewInv = m4.inverse(matAccum1, new Float32Array(16));
    const normalMatrix = m4.transpose(modelviewInv, new Float32Array(16));
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    let lightPos = [0, 0, -1];
    lightPos = [parameters.lightPostionX, parameters.lightPostionY, parameters.lightPostionZ];
    gl.uniform3fv(shProgram.iLightPos, lightPos);

    let lmat = m4.lookAt(lightPos, target, up);
    lmat = m4.multiply(m4.xRotation(deg2rad(parameters.spotlightRotationX)), lmat);
    lmat = m4.multiply(m4.yRotation(deg2rad(parameters.spotlightRotationY)), lmat);
    let lightDirection = [-lmat[8], -lmat[9], -lmat[10]];

    gl.uniform3fv(shProgram.iLightDirection, lightDirection);

    gl.uniform1f(shProgram.iShininess, parameters.shininess);
    gl.uniform1f(shProgram.Ka, parameters.ka);
    gl.uniform1f(shProgram.Kd, parameters.kd);
    gl.uniform1f(shProgram.Ks, parameters.ks);

    gl.uniform3fv(shProgram.viewWorldPositionLocation, [0, 0, 0]);

    let innerLimit = deg2rad(parameters.innerLimit);
    let outerLimit = deg2rad(parameters.outerLimit);

    let deg = deg2rad(10);
    gl.uniform1f(shProgram.spotlightAngle, deg);
    gl.uniform1f(shProgram.iInnerLimit, Math.cos(innerLimit));
    gl.uniform1f(shProgram.iOuterLimit, Math.cos(outerLimit));

    gl.uniform3fv(shProgram.iAmbientColor, [0.2, 0.1, 0.0]);
    gl.uniform3fv(shProgram.iDiffuseColor, [1.0, 1.0, 0.0]);
    gl.uniform3fv(shProgram.iSpecularColor, [1.0, 1.0, 1.0]);

    surface.Draw();
}

/**
 * Draws a surface with defualt values.
 */
function drawDefault() {
    initParameters();
    updateDataAndDraw();
    
}

/**
 * Draws a surface with parameters entered by user on UI.
 */
function redraw() {
    setNewParameters();
    updateDataAndDraw();
}

/**
 * Gets parameters from UI and updates it on program config.
 */
function setNewParameters() {
    parameters.a = getValueByElementId('a');
    parameters.b = getValueByElementId('b');
    parameters.zStep = getValueByElementId('zStep');
    parameters.angleStep = getValueByElementId('angleStep');
    parameters.ka = getValueByElementId('ka')
    parameters.kd = getValueByElementId('kd');
    parameters.ks =  getValueByElementId('ks');
    parameters.shininess = getValueByElementId('shininess');

    parameters.lightPostionX = getValueByElementId('lightPostionX');
    parameters.lightPostionY = getValueByElementId('lightPostionY');
    parameters.lightPostionZ = getValueByElementId('lightPostionZ');

    parameters.spotlightRotationX = getValueByElementId('spotlightRotationX');
    parameters.spotlightRotationY = getValueByElementId('spotlightRotationY');

    parameters.innerLimit = getValueByElementId('innerLimit');
    parameters.outerLimit = getValueByElementId('outerLimit');
}

/**
 * Updates buffer data and draws a surface.
 */
function updateDataAndDraw() {
    surface.BufferData(CreateSurfaceData());
    draw();
}

/**
 * Gets value from UI by its element id.
 */
function getValueByElementId(elementId) {
    const value = document.getElementById(elementId).value;
    if (value) {
        return parseFloat(value);
    }
    document.getElementById(elementId).value = parameters[elementId];
    return parameters[elementId];
}

/**
 * Creates surface data by explicit equation of 'Surface of Revolution "Pear"' 
 */
function CreateSurfaceData() {
    let vertexList = [];
    let tempVertList = [];
    let facesList = [];
    
    let angleStep = Math.PI / parameters.angleStep;

    for (let angle = 0; angle <= maxAngle; angle += angleStep) {
        for (let z = 0; z <= (parameters.a - parameters.zStep).toFixed(2); z = +(parameters.zStep + z).toFixed(2)) {
            let p1 = calcVertPoint(z, angle);
            let p2 = calcVertPoint(z, angle + angleStep);
            let p3 = calcVertPoint(+(parameters.zStep + z).toFixed(2), angle);
            let p4 = calcVertPoint(+(parameters.zStep + z).toFixed(2), angle + angleStep);

            facesList.push([p1, p2, p3], [p2, p4, p3]);
            tempVertList.push(p1, p2, p3, p4);
        }
    }

    let tp1 = new Point(0, 0, 0);
    let tp2 = new Point(20, 0, 0);
    let tp3 = new Point(20, 20, 20);
    let tp4 = new Point(0, 20, 0);
    // facesList = [[tp1, tp2, tp3]];
    // tempVertList = [tp1, tp2, tp3];
    let vertexNormals = [];
    for (let i = 0; i < tempVertList.length; i++) {
        let thisVertexNormal = [0, 0, 0];
        for (let j = 0; j < facesList.length; j++) {
            const face = facesList[j];
            if (face.includes(tempVertList[i])) {
                let p1 = face[0];
                let p2 = face[1];
                let p3 = face[2];
                let n = calcNormPoint(p1, p2, p3);
                thisVertexNormal[0] += n.x;
                thisVertexNormal[1] += n.y;
                thisVertexNormal[2] += n.z;
            }
        }
        const normalizedNormal = m4.normalize(thisVertexNormal);
        vertexNormals.push(normalizedNormal[0], normalizedNormal[1], normalizedNormal[2]);
        vertexList.push(tempVertList[i].x, tempVertList[i].y, tempVertList[i].z);
    }

    return new SurfaceData(vertexList, vertexNormals);
}

function calcVertPoint(z, angle) {
    let rZ = RZ(z);
    let x = X(rZ, angle);
    let y = Y(rZ, angle);
    return new Point(x, y, z);
}

function calcNormPoint(p1, p2, p3) {
    let v1 = m4.subtractVectors(p2.transformVector(), p1.transformVector());
    let v2 = m4.subtractVectors(p3.transformVector(), p1.transformVector());
    let cp = m4.cross(v1, v2);
    let n = m4.normalize(cp);
    return new Point(n[0], n[1], n[2]);
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vVertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, 'vNormal');
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, 'normalMat');

    shProgram.iAmbientColor              = gl.getUniformLocation(prog, 'ambientColor');
    shProgram.iDiffuseColor              = gl.getUniformLocation(prog, 'diffuseColor');
    shProgram.iSpecularColor             = gl.getUniformLocation(prog, 'specularColor');

    shProgram.iShininess                 = gl.getUniformLocation(prog, 'shininess');

    shProgram.Ka                         = gl.getUniformLocation(prog, 'Ka');
    shProgram.Kd                         = gl.getUniformLocation(prog, 'Kd');
    shProgram.Ks                         = gl.getUniformLocation(prog, 'Ks');

    shProgram.iLightPos                  = gl.getUniformLocation(prog, 'lightPosition');
    
    shProgram.iLightDirection            = gl.getUniformLocation(prog, "uLightDirection");
    shProgram.iInnerLimit                = gl.getUniformLocation(prog, "u_innerLimit");
    shProgram.iOuterLimit                = gl.getUniformLocation(prog, "u_outerLimit");
    
    shProgram.spotlightAngle             = gl.getUniformLocation(prog, "uSpotlightAngle");

    surface = new Model('Surface of Revolution "Pear"');
    initParameters();
    setBufferData(surface);

    gl.enable(gl.DEPTH_TEST);
}

function setBufferData(surface) {
    surface.BufferData(CreateSurfaceData());
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

let lightPositionEl;
/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    lightPositionEl = document.getElementById('lightPostion');
    spotlightAngle = document.getElementById('spotlightAngle');
    spotlightRotation = document.getElementById('spotlightRotation');
    
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}
