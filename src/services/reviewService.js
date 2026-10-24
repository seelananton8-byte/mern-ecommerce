import { backendRequest } from "./api";

const reviewsPath = (productId) =>
  `/products/${encodeURIComponent(productId)}/reviews`;

export function getReviews(productId, page = 1) {
  return backendRequest(`${reviewsPath(productId)}?page=${page}&limit=10`);
}

export function getMyReview(productId) {
  return backendRequest(`${reviewsPath(productId)}/mine`);
}

export function saveReview(productId, { rating, comment }) {
  return backendRequest(reviewsPath(productId), {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}

export function deleteReview(productId, reviewId) {
  return backendRequest(
    `${reviewsPath(productId)}/${encodeURIComponent(reviewId)}`,
    { method: "DELETE" }
  );
}