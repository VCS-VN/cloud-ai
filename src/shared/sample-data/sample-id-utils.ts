const productIds = [
  "fd30ec41-2910-4fb7-83cc-6c6f182c5e5e",
  "0ecf6a24-1a77-4b76-8f4d-95f9c53b7b21",
  "db34bf7a-4fe4-4d77-bf38-f9b3d5512a0e",
  "a72f2c21-83d1-4fc4-b44d-24dbf3a6a1f8",
  "35a77df1-1e9d-4142-9144-13a8d9126107",
  "e04e645b-7745-4950-9892-0102da231f58",
];

const modelIds = [
  "c1ab77a4-6e1b-40c3-a394-2bea20b080ff",
  "8f5d5e6f-1b46-4972-8b45-1b5c4aefb521",
  "ae092df5-f26b-4876-8f88-078152e15d1d",
  "88d4aef5-29db-468e-8d23-1f2a3787cd62",
  "24deea9b-d20b-4808-bce1-c34f2a7417e2",
  "fe72afdf-8c1b-4e64-bc1b-5d2c50c490ef",
];

function fallbackId(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(12, "0")}`;
}

export function createSampleProductId(index: number) {
  return productIds[index] ?? fallbackId("sample-product", index);
}

export function createSampleModelId(index: number) {
  return modelIds[index] ?? fallbackId("sample-model", index);
}

export function createSampleSku(index: number) {
  return `NAIL-${String(index + 1).padStart(4, "0")}`;
}
