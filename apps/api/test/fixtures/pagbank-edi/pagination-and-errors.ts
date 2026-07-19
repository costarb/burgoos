import { PAGBANK_SALE_FIXTURES } from "./transactional";

export const PAGBANK_PAGE_1 = {
  detalhes: [PAGBANK_SALE_FIXTURES.credit],
  pagination: { elements: 1, totalPages: 2, page: 1, totalElements: 2 },
};
export const PAGBANK_PAGE_2 = {
  detalhes: [PAGBANK_SALE_FIXTURES.pix],
  pagination: { elements: 1, totalPages: 2, page: 2, totalElements: 2 },
};
export const PAGBANK_INVALID_RESPONSE = { detalhes: "invalid", pagination: null };
