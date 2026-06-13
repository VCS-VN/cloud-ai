---
target: src/app/cart-selection.ts
---
import { atom } from "jotai";

export const selectedCartItemIdsAtom = atom<string[]>([]);
