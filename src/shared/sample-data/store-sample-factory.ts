import type { Store } from "./store-product-types";
import { cloneSampleData } from "./store-product-update";

const sampleStore: Store = {
  id: "05cdd3e2-2e27-44f1-9d39-753814de06f9",
  slug: "retail-topic*nail-studio",
  statusId: 1,
  userId: "user_01KH5D9KFP6MWHZ4ZC33KPK0DQ",
  name: "Nail Studio",
  address:
    "Chung cư cán bộ, nhân viên bộ tổng Tham Mưu, Đường Cầu Khoát, Tây Tựu, Từ Liêm, Hà Nội",
  phoneNumber: "+8488040437",
  placeId:
    "EzmaZl-NJIRggqqxm0AlnH1YhXqdVrPYY74vQLcIhZlgsRhY52Kr6WGtHHmnUaTVZpV6RJxyuKFM2xIzoFGB_HH-CG6tLC7_Neb2jWJ1tf_R4hwtQq50LnXqvIFCdCubd",
  image: null,
  metadata: {},
  logo: null,
  businessType: "RETAIL",
  postalCode: "10000",
  setting: {
    isVerifiedProfile: false,
    country: "VN",
    currency: "AUD",
    paymentMethods: [],
  },
};

export function createSampleStore(): Store {
  return cloneSampleData(sampleStore);
}
