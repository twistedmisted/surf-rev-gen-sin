'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let parameters = {};

let countHorizontalLines = 0;
let countVerticalLines = 0;

const maxAngle = 2 * Math.PI;

function initParameters() {
    parameters = {
        a: 3,
        b: 1,
        zStep: 0.1,
        angleStep: 5
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
    this.verticesLength = 0;
    
    this.BufferData = function(vertices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        this.verticesLength = vertices.length;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
   
        // Draw horizontal lines
        for (let i = 0; i < countHorizontalLines; i += 1) {
            gl.drawArrays(gl.LINE_STRIP, countVerticalLines * i, countVerticalLines);
        }

        // Draw vertical lines
        let startOfVerticalVertex = this.verticesLength / (2 * 3);
        for (let i = 0; i < countVerticalLines; i += 1) {
            gl.drawArrays(gl.LINE_STRIP, startOfVerticalVertex + (countHorizontalLines * i), countHorizontalLines);
        }
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a 'Surface of Revolution "Pear"' */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 3, 1, 1, 20); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    
    gl.uniform4fv(shProgram.iColor, [1,1,0,1] );

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
function CreateSurfaceData()
{
    let vertexList = [];

    countHorizontalLines = 0;
    countVerticalLines = 0;
    
    let angleStep = Math.PI / parameters.angleStep;

    // Horizontal lines
    for (let z = 0; z <= parameters.a; z = +(parameters.zStep + z).toFixed(2)) {
        console.log("z = " + z)
        for (let angle = 0; angle <= maxAngle; angle += angleStep) {
            let rZ = RZ(z);
            let x = X(rZ, angle);
            let y = Y(rZ, angle);
            vertexList.push(x, y, z);
        }
        countHorizontalLines += 1;
    }

    // Vertical lines
    for (let angle = 0; angle <= maxAngle; angle += angleStep) {
        for (let z = 0; z <= parameters.a; z = +(parameters.zStep + z).toFixed(2)) {
            let rZ = RZ(z);
            let x = X(rZ, angle);
            let y = Y(rZ, angle);
            vertexList.push(x, y, z);
        }
        countVerticalLines += 1;
    }

    return vertexList;
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

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


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
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
