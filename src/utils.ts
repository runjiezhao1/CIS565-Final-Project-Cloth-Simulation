import { vec3 } from "gl-matrix";

export function parseOBJ(objData: string) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const lines = objData.split("\n");

  for (let line of lines) {
    const parts = line.trim().split(" ");
    const type = parts[0];

    if (type === "v") {
      // Vertex position
      vertices.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === "f") {
      // Face indices (OBJ uses 1-based indexing)
      indices.push(
        parseInt(parts[1].split("/")[0]) - 1,
        parseInt(parts[2].split("/")[0]) - 1,
        parseInt(parts[3].split("/")[0]) - 1
      );
    }
  }
  return { vertices, indices };
}

export class ObjModel {
  vertices: number[] = [];
  indices: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  pureVertices : number[][] = [];
  pureFaces : number[] = [];
}

export class ObjLoader {
  parse(objData: string, scale: number = 1.0): ObjModel {
      var _model = new ObjModel();
      const vertexPositions: number[][] = [];
      const vertexNormals: number[][] = [];
      const uv: number[][] = [];
      const faces: string[][] = [];

      objData.split('\n').forEach(line => {
          const parts = line.trim().split(/\s+/);
          switch (parts[0]) {
              case 'v':
                  const scaledPosition = parts.slice(1).map(parseFloat).map(coord => coord * scale);
                  vertexPositions.push(scaledPosition);
                  break;
              case 'vn':
                  vertexNormals.push(parts.slice(1).map(parseFloat));
                  break;
              case 'vt':
                  uv.push(parts.slice(1).map(parseFloat));
                  break;
              case 'f':
                  faces.push(parts.slice(1));
                  break;
          }
      });
      _model.pureVertices = vertexPositions;
      const indexMap = new Map<string, number>();
      let currentIndex = 0;

      faces.forEach(faceParts => {
          const faceIndices = faceParts.map(part => {
              const [pos, tex, norm] = part.split('/').map(e => parseInt(e) - 1);
              const key = `${pos}|${tex}|${norm}`;
              if (indexMap.has(key)) {
                  return indexMap.get(key)!;
              } else {
                  const position = vertexPositions[pos];
                  _model.pureFaces.push(pos);
                  _model.vertices.push(...position);
                  const _uv = uv[tex];
                  if(_uv===undefined){
                      _model.uvs.push(0.01, 0.01);
                  }
                  else{
                      _model.uvs.push(..._uv);
                  }

                  if (vertexNormals.length > 0 && norm !== undefined) {
                      const normal = vertexNormals[norm];
                      _model.normals.push(...normal);
                  }

                  indexMap.set(key, currentIndex);
                  return currentIndex++;
              }
          });

          for (let i = 1; i < faceIndices.length - 1; i++) {
              _model.indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
          }
      });

      if (vertexNormals.length === 0) {
          this.calculateNormals(_model.vertices, _model.indices).forEach(n => _model.normals.push(n));
      }

      return _model;
  }

  calculateNormals(vertices: number[], indices: number[]): number[] {
      const normals = new Array(vertices.length / 3).fill(0).map(() => [0, 0, 0]);

      for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i];
          const i1 = indices[i + 1];
          const i2 = indices[i + 2];

          const v1 = vertices.slice(i0 * 3, i0 * 3 + 3);
          const v2 = vertices.slice(i1 * 3, i1 * 3 + 3);
          const v3 = vertices.slice(i2 * 3, i2 * 3 + 3);

          const u = v2.map((val, idx) => val - v1[idx]);
          const v = v3.map((val, idx) => val - v1[idx]);

          const norm = [
              u[1] * v[2] - u[2] * v[1],
              u[2] * v[0] - u[0] * v[2],
              u[0] * v[1] - u[1] * v[0]
          ];

          for (let j = 0; j < 3; j++) {
              normals[i0][j] += norm[j];
              normals[i1][j] += norm[j];
              normals[i2][j] += norm[j];
          }
      }

      const normalizedNormals = normals.flatMap(norm => {
          const len = Math.sqrt(norm[0] ** 2 + norm[1] ** 2 + norm[2] ** 2);
          return [norm[0] / len, norm[1] / len, norm[2] / len];
      });

      return normalizedNormals;
  }

  async load(url: string, scale: number = 1.0): Promise<ObjModel> {
      const response = await fetch(url);
      const objData = await response.text();
      return this.parse(objData, scale);
  }
}


export const makeFloat32ArrayBufferStorage = (device: GPUDevice, data: any) => {
  const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true
  });
  new Float32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

export const makeFloat32ArrayBuffer = (device: GPUDevice, data: any) => {
  const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
  });
  new Float32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

export function makeUInt32ArrayBuffer(device: GPUDevice, data: any) {
  const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
  });
  new Uint32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

export function makeUInt32IndexArrayBuffer(device: GPUDevice, data: any) {
  const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
      mappedAtCreation: true
  });
  new Uint32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

export function calculateNormal(v0: vec3, v1: vec3, v2: vec3) {
  let edge1 = vec3.create();
  let edge2 = vec3.create();
  let normal = vec3.create();

  vec3.subtract(edge1, v1, v0);
  vec3.subtract(edge2, v2, v0);
  vec3.cross(normal, edge1, edge2);
  vec3.normalize(normal, normal);

  return normal;
}

export class ImageLoader {
  device: GPUDevice;

  constructor(device: GPUDevice) {
      this.device = device;
  }

  async loadImage(url: string): Promise<GPUTexture> {
      const image = await this.loadImageElement(url);
      const texture = this.createTextureFromImage(image);
      return texture;
  }

  private loadImageElement(url: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
          const image = new Image();
          image.src = url;
          image.onload = () => resolve(image);
          image.onerror = reject;
      });
  }

  private createTextureFromImage(image: HTMLImageElement): GPUTexture {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext('2d');
      if (!context) {
          throw new Error("Failed to create canvas 2D context");
      }

      context.drawImage(image, 0, 0);

      const imageData = context.getImageData(0, 0, image.width, image.height);
      const texture = this.device.createTexture({
          size: [image.width, image.height, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      this.device.queue.writeTexture(
          { texture },
          imageData.data,
          {
              bytesPerRow: image.width * 4,
              rowsPerImage: image.height,
          },
          [image.width, image.height, 1]
      );

      return texture;
  }
}
