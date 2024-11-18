import { mat4, vec3 } from 'gl-matrix';
import { toRadians } from '../math_utils';
import { GUIController } from '../gui/gui';

export class Camera {
    position: vec3;
    target: vec3;
    up: vec3;
    aspectRatio: number;
    fovY: number;
    near: number;
    far: number;
    projectionMatrix: mat4;
    viewMatrix: mat4;
    yaw: number;
    pitch: number;
    radius: number;
    sensitivity: number;

    constructor(
        aspectRatio: number,
        fovY: number = 45 * (Math.PI / 180),
        near: number = 0.01,
        far: number = 100000.0,
        radius: number = 150, // default distance from target
    ) {
        this.position = vec3.fromValues(0, 20, 100); // Camera starting position
        this.target = vec3.fromValues(0, 0, 0);   // Look at the origin
        this.up = vec3.fromValues(0, 1, 0);       // Up direction

        this.aspectRatio = aspectRatio;
        this.fovY = fovY;
        this.near = near;
        this.far = far;
        this.radius = radius;

        this.projectionMatrix = mat4.create();
        this.viewMatrix = mat4.create();

        this.yaw = -90; 
        this.pitch = 0;
        this.sensitivity = 0.1;

        this.updateProjectionMatrix();
        this.updateViewMatrix();
    }

    updateProjectionMatrix() {
        mat4.perspective(this.projectionMatrix, this.fovY, this.aspectRatio, this.near, this.far);
    }

    updateViewMatrix() {
        const front = vec3.create();
        front[0] = this.radius * Math.cos(toRadians(this.pitch)) * Math.cos(toRadians(this.yaw));
        front[1] = this.radius * Math.sin(toRadians(this.pitch));
        front[2] = this.radius * Math.cos(toRadians(this.pitch)) * Math.sin(toRadians(this.yaw));

        vec3.add(this.position, this.target, front); // Position is target + front vector

        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up); // Update view matrix
    }

    moveForward(amount: number) {
        this.radius -= amount;
        if (this.radius < 1) this.radius = 1; // Prevent zooming in too much
        this.updateViewMatrix();
    }

    moveRight(amount: number) {
        const right = vec3.create();
        const forward = vec3.subtract(vec3.create(), this.target, this.position);
        vec3.cross(right, forward, this.up);  // Get the right direction (cross product)
        vec3.normalize(right, right);
        vec3.scale(right, right, amount * this.sensitivity);
        vec3.add(this.position, this.position, right);
        vec3.add(this.target, this.target, right);
        this.updateViewMatrix();
    }

    moveUp(amount: number) {
        const up = vec3.fromValues(0, 1, 0);
        vec3.scale(up, up, amount * this.sensitivity);
        vec3.add(this.position, this.position, up);
        vec3.add(this.target, this.target, up);
        this.updateViewMatrix();
    }

    look(deltaX: number, deltaY: number) {
        this.yaw += deltaX * this.sensitivity;
        this.pitch += deltaY * this.sensitivity;

        if (this.pitch > 89.0) this.pitch = 89.0;
        if (this.pitch < -89.0) this.pitch = -89.0;

        this.updateViewMatrix();
    }

    // Get the camera's view matrix for rendering
    getViewMatrix(): mat4 {
        return this.viewMatrix;
    }
}

//export default Camera;