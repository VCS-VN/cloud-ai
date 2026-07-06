---
target: src/routes/products/$productId.tsx
---
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { useCart } from "@/app/cart-provider";
import { useStore } from "@/app/store-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatMoney, resolveProductPrice } from "@/lib/format-money";
import { useProductDetail } from "@/services/store/use-product-detail";
import type { ProductModel } from "@/services/store/use-products-list";

export const Route = createFileRoute("/products/$productId")({
  component: ProductDetailPage,
});

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
// APPEND_MARKER
