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